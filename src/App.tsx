import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { ArrowRight, ChevronLeft, ChevronRight, LogIn, LogOut, Maximize, Moon, Pause, Play, Radio, RotateCcw, Send, Sun, X } from 'lucide-react'
import { NetworkScene, type Theme } from './NetworkScene'
import { CHOICES, DEFAULT_SCENARIO, FEATURES, LAYER_LABELS, choiceLabel, classroomNetwork, type ChoiceId, type LearningTrace, type Scenario, type Trace } from './network'
import { ClassroomBus, getSupabaseClient, initializeSupabaseClient, sanitizeRoom, type ConnectionState } from './supabase'

function Brand() {
  return <a className="brand" href="https://paulonascimento.me" target="_blank" rel="noreferrer"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="95" fill="currentColor"/><g transform="translate(97 100)" fill="none" stroke="#0a0c10" strokeWidth="8"><path d="M-36 36V-36H-14A20 20 0 0 1-14 4H-36"/><path d="M8 36V-36L42 36V-36"/></g></svg><span>Paulo <em>Nascimento</em><small>Laboratório</small></span></a>
}

type AuthState = 'booting' | 'anonymous' | 'checking' | 'authenticated' | 'unauthorized' | 'error' | 'configuration'
function AuthGate({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(() => getSupabaseClient()); const [configurationResolved, setConfigurationResolved] = useState(false); const [state, setState] = useState<AuthState>('booting'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState('')
  const authorizedId = useRef<string | null>(null); const pendingId = useRef<string | null>(null)
  useEffect(() => {
    let active = true
    void initializeSupabaseClient().then((configuredClient) => { if (active) { setClient(configuredClient); setConfigurationResolved(true) } })
    return () => { active = false }
  }, [])
  const authorize = useCallback(async (session: Session) => {
    if (!client) return; const id = session.user.id
    if (authorizedId.current === id) { setState('authenticated'); return }
    if (pendingId.current === id) return
    pendingId.current = id
    const { data, error } = await client.rpc('pulso_is_admin')
    if (pendingId.current !== id) return
    pendingId.current = null
    if (error) { setMessage('Não foi possível validar o acesso.'); setState('error') }
    else if (data === true) { authorizedId.current = id; setState('authenticated') }
    else { setMessage(session.user.email || 'Esta conta'); setState('unauthorized') }
  }, [client])
  useEffect(() => {
    if (!configurationResolved) return
    if (!client) { setState('configuration'); return }
    let active = true
    const { data: listener } = client.auth.onAuthStateChange((event, session) => { window.setTimeout(() => { if (!active) return; if (event === 'SIGNED_OUT') { authorizedId.current = null; pendingId.current = null; setState('anonymous') } else if (session && authorizedId.current !== session.user.id) void authorize(session) }, 0) })
    void client.auth.getSession().then(({ data, error }) => { if (!active) return; if (error) { setMessage('Não foi possível restaurar sua sessão.'); setState('error') } else if (data.session) void authorize(data.session); else setState('anonymous') })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [authorize, client, configurationResolved])
  const signIn = async (event: FormEvent) => { event.preventDefault(); if (!client) return; setState('checking'); setMessage(''); const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password }); if (error || !data.session) { setMessage('E-mail ou senha incorretos.'); setState('anonymous') } else await authorize(data.session) }
  const signOut = async () => { await client?.auth.signOut(); authorizedId.current = null; setState('anonymous') }
  if (state === 'authenticated') return <>{children}<button className="signout" onClick={() => void signOut()}><LogOut size={15}/> Sair</button></>
  const title = state === 'booting' ? 'Retomando sessão' : state === 'checking' ? 'Verificando acesso' : state === 'unauthorized' ? 'Conta sem acesso' : state === 'error' ? 'Conexão interrompida' : 'Entrar'
  return <main className="auth-page"><section className="auth-shell"><Brand/><span className="eyebrow">Deep Learning ao Vivo</span><h1>{title}</h1>{state === 'booting' || state === 'checking' ? <div className="loading"><i/>Restaurando seu acesso…</div> : state === 'configuration' ? <p className="form-error">A configuração do Supabase não chegou a esta implantação. Confirme as variáveis compartilhadas e gere um novo deployment.</p> : state === 'unauthorized' ? <><p className="form-error"><strong>{message}</strong> não possui acesso.</p><button className="button secondary" onClick={() => void signOut()}>Usar outra conta</button></> : <form className="auth-form" onSubmit={(event) => void signIn(event)}><label>E-mail<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)}/></label><label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}/></label>{message && <p className="form-error">{message}</p>}<button className="button primary"><LogIn size={18}/>Entrar</button></form>}</section></main>
}

function Connection({ state }: { state: ConnectionState }) { const labels = { connecting: 'Conectando', connected: 'Ao vivo', local: 'Modo local', error: 'Sem conexão' }; return <span className={`connection ${state}`}><i/>{labels[state]}</span> }
const STAGES = [
  { short: 'Situação', technical: 'Entrada', title: 'Descrever a situação', text: 'A rede recebe seis aspectos concretos do trajeto. Ainda não há decisão: são apenas os fatos apresentados pelo participante.' },
  { short: 'Escala', technical: 'Normalização', title: 'Colocar tudo na mesma escala', text: 'Quilômetros e porcentagens têm tamanhos diferentes. A rede converte todos os valores para uma escala de 0 a 1.' },
  { short: 'Pesar', technical: 'Soma ponderada', title: 'Dar importância diferente a cada fato', text: 'Cada conexão possui um peso. Entrada × peso mede quanto aquele fato influencia um neurônio.' },
  { short: 'Ativar', technical: 'ReLU', title: 'Decidir quais sinais continuam', text: 'Resultados negativos são silenciados. Sinais positivos seguem adiante e formam uma interpretação intermediária.' },
  { short: 'Aprofundar', technical: 'Camada oculta 2', title: 'Combinar interpretações', text: 'Uma segunda camada combina ideias simples, como distância e chuva, em alternativas mais úteis, como rapidez e conforto.' },
  { short: 'Pontuar', technical: 'Logits', title: 'Dar uma nota a cada escolha', text: 'As últimas conexões produzem quatro notas: caminhar, bicicleta, transporte público e carro/aplicativo.' },
  { short: 'Comparar', technical: 'Softmax', title: 'Transformar notas em probabilidades', text: 'As notas são convertidas em percentuais comparáveis que somam 100%.' },
  { short: 'Decidir', technical: 'Predição', title: 'Apresentar a hipótese da rede', text: 'A maior probabilidade vira a previsão. Depois, a escolha real do participante permite ensinar a rede.' },
] as const

const STAGE_LAYERS = [
  { number: 1, name: 'Entrada', shape: 'vetor com 6 valores' },
  { number: 1, name: 'Entrada', shape: 'vetor normalizado [6]' },
  { number: 2, name: 'Oculta 1', shape: '8 somas ponderadas' },
  { number: 2, name: 'Oculta 1', shape: 'vetor ativado [8]' },
  { number: 3, name: 'Oculta 2', shape: 'vetor ativado [6]' },
  { number: 4, name: 'Saída', shape: 'vetor de notas [4]' },
  { number: 4, name: 'Saída', shape: 'vetor de probabilidades [4]' },
  { number: 4, name: 'Saída', shape: 'argmax do vetor [4]' },
] as const

function Home({ room, setRoom }: { room: string; setRoom: (room: string) => void }) {
  return <main className="home-page"><section className="hero"><div><Brand/><span className="eyebrow">Laboratório de Deep Learning</span><h1>Como uma máquina<br/><em>aprende com um erro?</em></h1><p>Veja uma rede neural transformar uma situação cotidiana em decisão — e mudar seus próprios pesos depois de comparar a previsão com uma escolha humana.</p></div><div className="room-panel"><label>Sala<input value={room} onChange={(e) => setRoom(sanitizeRoom(e.target.value))}/></label><a className="route-card primary-card" href={`/display?room=${room}`}><Radio/><span><strong>Tela do projetor</strong><small>Visualização, cálculos e condução</small></span><ArrowRight/></a><a className="route-card" href={`/input?room=${room}`}><Send/><span><strong>Tela do participante</strong><small>Montar o cenário e revelar a escolha</small></span><ArrowRight/></a></div></section></main>
}

function ScenarioForm({ value, onChange }: { value: Scenario; onChange: (next: Scenario) => void }) {
  return <div className="scenario-form">{FEATURES.slice(0, 5).map((feature) => { const key = feature.key as keyof Scenario; return <label key={feature.key}><span>{feature.label}<strong>{value[key]}{feature.unit}</strong></span><input type="range" min={feature.min} max={feature.max} step={feature.key === 'distance' ? .5 : 5} value={value[key]} onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}/></label> })}<label className="switch-row"><span>Transporte público disponível</span><button type="button" className={value.transit ? 'switch on' : 'switch'} onClick={() => onChange({ ...value, transit: value.transit ? 0 : 1 })}><i/>{value.transit ? 'Sim' : 'Não'}</button></label></div>
}

function InputPage({ room }: { room: string }) {
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO); const [connection, setConnection] = useState<ConnectionState>('connecting'); const [sent, setSent] = useState(false); const [prediction, setPrediction] = useState<ChoiceId | null>(null); const [chosen, setChosen] = useState<ChoiceId | null>(null)
  const bus = useMemo(() => new ClassroomBus(room, 'input'), [room])
  useEffect(() => { bus.on('prediction', (payload) => setPrediction(payload.predicted as ChoiceId)); bus.on('reset', () => { setSent(false); setPrediction(null); setChosen(null) }); bus.connect(setConnection); return () => bus.disconnect() }, [bus])
  const sendScenario = async () => { setSent(true); setChosen(null); setPrediction(null); await bus.send('scenario', { scenario }) }
  const sendChoice = async (choice: ChoiceId) => { setChosen(choice); await bus.send('choice', { choice }) }
  return <main className="input-page"><header><Brand/><Connection state={connection}/></header><section className="input-card"><span className="eyebrow">Sala {room}</span><h1>Como você iria até um compromisso?</h1><p>Monte uma situação. A rede tentará prever sua escolha — depois você mostra o que realmente faria.</p>{!sent ? <><ScenarioForm value={scenario} onChange={setScenario}/><button className="button primary large" onClick={() => void sendScenario()}><Send/>Enviar situação</button></> : <div className="participant-choice"><span className="step-ok">Situação recebida na projeção</span>{!prediction ? <div className="participant-wait"><i/><h2>Acompanhe a projeção</h2><p>A escolha será liberada quando a rede concluir os oito passos.</p></div> : <><h2>O que você realmente escolheria?</h2><p>A rede previu <strong>{choiceLabel(prediction)}</strong>. Agora revele sua decisão.</p><div className="choice-grid">{CHOICES.map((choice) => <button key={choice.id} disabled={chosen !== null} className={chosen === choice.id ? 'selected' : ''} onClick={() => void sendChoice(choice.id)}><b>{choice.icon}</b><span>{choice.label}</span></button>)}</div>{chosen && <div className="choice-sent">Escolha enviada. Agora veja a rede aprender na projeção.</div>}</>}<button className="button secondary" onClick={() => { setSent(false); setPrediction(null); setChosen(null) }}><RotateCcw/>Montar outra situação</button></div>}</section></main>
}

function ProbabilityBars({ trace, previous }: { trace: Trace; previous?: Trace }) {
  return <div className="probability-list">{CHOICES.map((choice, index) => <div key={choice.id}><span>{choice.icon} {choice.label}</span><i><b style={{ width: `${Math.max(2, trace.probabilities[index] * 100)}%` }}/>{previous && <em style={{ left: `${previous.probabilities[index] * 100}%` }}/>}</i><strong>{Math.round(trace.probabilities[index] * 100)}%</strong></div>)}</div>
}

function OutputVectors({ trace, showLogits = true }: { trace: Trace; showLogits?: boolean }) {
  const values = (vector: number[]) => `[${vector.map((value) => value.toFixed(3)).join(', ')}]`
  return <div className="output-vectors">
    {showLogits && <div><small>Vetor de notas · logits</small><code>{values(trace.logits)}</code></div>}
    <div><small>Vetor de probabilidades · softmax</small><code>{values(trace.probabilities)}</code></div>
    <div className="vector-order"><span>0 A pé</span><span>1 Bicicleta</span><span>2 Transporte</span><span>3 Carro/app</span></div>
  </div>
}

function Calculation({ scenario, trace, stage }: { scenario: Scenario; trace: Trace; stage: number }) {
  const inputIndex = stage % trace.normalized.length; const h1Index = 0
  if (stage === 0) return <div className="calc"><code>{scenario.distance} km · {scenario.rain}% chuva · {scenario.urgency}% pressa</code><p>Esses são fatos, não respostas.</p></div>
  if (stage === 1) return <div className="calc equation"><span>{scenario.distance} km</span><b>÷ 30</b><span>= {trace.normalized[0].toFixed(2)}</span><p>A mesma regra é aplicada às seis entradas.</p></div>
  if (stage === 2) { const weights = [-2.8,-.2,-.4,-.4,.2,0]; const terms = trace.normalized.map((value, i) => value * weights[i]); return <div className="calc"><small>Exemplo: neurônio “perto”</small><code>{trace.normalized[inputIndex].toFixed(2)} × {weights[inputIndex].toFixed(1)} = {terms[inputIndex].toFixed(2)}</code><p>Soma de todas as entradas + viés = <strong>{trace.hidden1Sums[h1Index].toFixed(2)}</strong></p></div> }
  if (stage === 3) return <div className="calc equation"><span>ReLU({trace.hidden1Sums[0].toFixed(2)})</span><b>=</b><span>{trace.hidden1[0].toFixed(2)}</span><p>Se a soma fosse negativa, a saída seria zero.</p></div>
  if (stage === 4) return <div className="calc"><small>Seis novas combinações</small>{trace.hidden2.map((v, i) => <div className="mini-value" key={i}><span>{LAYER_LABELS[2][i]}</span><i><b style={{width:`${Math.min(100, Math.abs(v) * 32)}%`}}/></i><strong>{v.toFixed(2)}</strong></div>)}</div>
  if (stage === 5) return <><div className="calc"><small>Quatro neurônios, quatro notas</small><code>saída = camada_oculta × pesos + vieses</code><p>Cada posição pertence a uma alternativa.</p></div><OutputVectors trace={trace}/></>
  if (stage === 6) return <><div className="calc"><code>softmax(notas) = probabilidades</code><p>O vetor continua tendo quatro posições e agora soma 100%.</p></div><OutputVectors trace={trace}/><ProbabilityBars trace={trace}/></>
  return <><OutputVectors trace={trace}/><div className="decision"><b>{CHOICES.find(c=>c.id===trace.predicted)?.icon}</b><span>argmax(vetor) = posição {trace.probabilities.indexOf(Math.max(...trace.probabilities))}</span><strong>{choiceLabel(trace.predicted)}</strong><p>A decisão é a posição de maior valor; o resultado da camada continua sendo o vetor completo.</p></div></>
}

function LearningModal({ learning, onClose }: { learning: LearningTrace; onClose: () => void }) {
  const expectedIndex = CHOICES.findIndex((c) => c.id === learning.expected)
  return <div className="modal-backdrop"><section className="learning-modal"><button className="icon-button close" onClick={onClose}><X/></button><span className="eyebrow">A rede aprendeu com a escolha</span><h2>Do erro à mudança</h2><div className="comparison"><div><small>Antes</small><strong>{Math.round(learning.before.probabilities[expectedIndex]*100)}%</strong><span>para {choiceLabel(learning.expected)}</span></div><ArrowRight/><div><small>Depois</small><strong>{Math.round(learning.after.probabilities[expectedIndex]*100)}%</strong><span>para {choiceLabel(learning.expected)}</span></div></div><ProbabilityBars trace={learning.after} previous={learning.before}/><div className="learning-steps"><div><small>1 · Medir o erro</small><code>−log({learning.before.probabilities[expectedIndex].toFixed(3)}) = {learning.lossBefore.toFixed(3)}</code><span>Depois do treino: {learning.lossAfter.toFixed(3)}</span></div><div><small>2 · Descobrir a direção</small><code>gradiente = {learning.gradient.toFixed(4)}</code><span>O sinal diz para onde mover o peso.</span></div><div><small>3 · Atualizar o peso</small><code>{learning.weightBefore.toFixed(3)} − {learning.learningRate} × ({learning.gradient.toFixed(3)})</code><span>Novo peso demonstrativo: {learning.weightAfter.toFixed(3)}</span></div></div><p className="modal-note">As barras finas marcam as probabilidades anteriores. A rede executou 6 pequenos passos de correção usando a escolha do participante como exemplo.</p><button className="button primary" onClick={onClose}>Voltar à rede</button></section></div>
}

function DisplayPage({ room }: { room: string }) {
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO); const [trace, setTrace] = useState(() => classroomNetwork.predict(DEFAULT_SCENARIO)); const [stage, setStage] = useState(0); const [playing, setPlaying] = useState(false); const [connection, setConnection] = useState<ConnectionState>('connecting'); const [theme, setTheme] = useState<Theme>(() => localStorage.getItem('dl-theme') === 'light' ? 'light' : 'dark'); const [resetId, setResetId] = useState(0); const [learning, setLearning] = useState<LearningTrace | null>(null); const [choice, setChoice] = useState<ChoiceId | null>(null)
  const [showLearning, setShowLearning] = useState(false); const scenarioRef = useRef(scenario); const predictionSentRef = useRef(true)
  const bus = useMemo(() => new ClassroomBus(room, 'display'), [room])
  useEffect(() => { bus.on('scenario', (payload) => { const next = payload.scenario as Scenario; scenarioRef.current = next; predictionSentRef.current = false; const nextTrace = classroomNetwork.predict(next); setScenario(next); setTrace(nextTrace); setStage(0); setPlaying(true); setChoice(null); setLearning(null); setShowLearning(false) }); bus.on('choice', (payload) => { const expected = payload.choice as ChoiceId; setChoice(expected); const result = classroomNetwork.train(scenarioRef.current, expected); setLearning(result); setTrace(result.after); setShowLearning(true); setPlaying(false) }); bus.connect(setConnection); return () => bus.disconnect() }, [bus])
  useEffect(() => { if (stage === 7 && !predictionSentRef.current) { predictionSentRef.current = true; void bus.send('prediction', { predicted: trace.predicted }) } }, [bus, stage, trace.predicted])
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setStage((current) => { if (current >= 7) { setPlaying(false); return 7 } return current + 1 }), 2400); return () => window.clearInterval(timer) }, [playing])
  const toggleTheme = () => setTheme((current) => { const next = current === 'dark' ? 'light' : 'dark'; localStorage.setItem('dl-theme', next); return next })
  const reset = async () => { scenarioRef.current = DEFAULT_SCENARIO; predictionSentRef.current = true; setScenario(DEFAULT_SCENARIO); const next = classroomNetwork.predict(DEFAULT_SCENARIO); setTrace(next); setStage(0); setChoice(null); setLearning(null); setShowLearning(false); setResetId((id)=>id+1); await bus.send('reset') }
  return <main className={`display-page ${theme}`}><header><div><Brand/><span className="eyebrow">Deep Learning · Sala {room}</span><h1>Como uma máquina aprende com um erro?</h1></div><div className="header-actions"><Connection state={connection}/><button className="icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{theme === 'dark' ? <Sun/> : <Moon/>}</button><button className="icon-button" onClick={()=>setResetId((id)=>id+1)} aria-label="Restaurar câmera"><RotateCcw/></button><button className="icon-button" onClick={()=>void document.documentElement.requestFullscreen()} aria-label="Entrar em tela cheia"><Maximize/></button></div></header><section className="display-grid"><aside className="scenario-panel"><span className="panel-label">Situação do participante</span>{FEATURES.map((feature) => { const value = scenario[feature.key as keyof Scenario]; return <div className="scenario-value" key={feature.key}><span>{feature.label}</span><strong>{feature.key === 'transit' ? value ? 'Sim' : 'Não' : `${value}${feature.unit}`}</strong><i><b style={{width:`${feature.key === 'distance' ? value/30*100 : feature.key === 'transit' ? value*100 : value}%`}}/></i></div> })}<button className="button secondary" onClick={()=>void reset()}><RotateCcw/>Nova rodada</button></aside><section className="visual-stage"><nav className="stage-nav" aria-label="Etapas da rede">{STAGES.map((item,index)=><button key={item.short} className={index===stage?'active':index<stage?'done':''} aria-current={index===stage?'step':undefined} aria-label={`Etapa ${index+1}: ${item.short}`} onClick={()=>{setStage(index);setPlaying(false)}}><i>{index+1}</i><span>{item.short}</span></button>)}</nav><NetworkScene trace={trace} activeStage={stage} theme={theme} resetId={resetId} onSelectLayer={(layer)=>{setStage(Math.min(7,layer*2));setPlaying(false)}}/><div className="network-layer-map"><span>Camada 1<strong>Entrada · [6]</strong></span><span>Camada 2<strong>Oculta 1 · [8]</strong></span><span>Camada 3<strong>Oculta 2 · [6]</strong></span><span>Camada 4<strong>Saída · [4]</strong></span></div><small className="scene-help">Arraste para girar · Roda ou pinça para aproximar · Clique em um neurônio</small></section><aside className="explanation-panel" aria-live="polite"><span className="step-number">0{stage+1}</span><span className="eyebrow">{STAGES[stage].technical}</span><h2>{STAGES[stage].title}</h2><p>{STAGES[stage].text}</p><div className="calculation-heading"><span>Cálculo desta etapa</span><strong>Camada {STAGE_LAYERS[stage].number}/4 · {STAGE_LAYERS[stage].name}</strong><small>{STAGE_LAYERS[stage].shape}</small></div><Calculation scenario={scenario} trace={trace} stage={stage}/></aside></section><footer><button className="icon-button" aria-label="Etapa anterior" disabled={stage===0} onClick={()=>{setStage((s)=>Math.max(0,s-1));setPlaying(false)}}><ChevronLeft/></button><button className="button secondary" onClick={()=>setPlaying((value)=>!value)}>{playing?<><Pause/>Pausar</>:<><Play/>Reproduzir</>}</button><button className="icon-button" aria-label="Próxima etapa" disabled={stage===7} onClick={()=>{setStage((s)=>Math.min(7,s+1));setPlaying(false)}}><ChevronRight/></button>{learning && <button className="button primary" onClick={()=>setShowLearning(true)}>Ver como aprendeu</button>}</footer>{learning && showLearning && <LearningModal learning={learning} onClose={()=>setShowLearning(false)}/>}</main>
}

export default function App() {
  const params = new URLSearchParams(location.search); const [room,setRoom]=useState(sanitizeRoom(params.get('room'))); const path=location.pathname
  return <AuthGate>{path.startsWith('/input')?<InputPage room={room}/>:path.startsWith('/display')?<DisplayPage room={room}/>:<Home room={room} setRoom={setRoom}/>}</AuthGate>
}
