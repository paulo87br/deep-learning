# Deep Learning ao Vivo

Laboratório didático com duas telas sincronizadas para mostrar, com cálculos reais, como uma rede neural profunda faz uma previsão e aprende com o erro.

## Rotas

- `/input?room=AULA-IA` — tablet do participante.
- `/display?room=AULA-IA` — projeção e condução da aula.
- `/` — escolha da sala e das telas.

## O que é real

O navegador executa uma rede densa em TensorFlow.js com 6 entradas, camadas ocultas de 8 e 6 neurônios e 4 saídas. A interface mostra os mesmos valores usados pela rede: normalização, somas ponderadas, ReLU, logits e softmax. Quando o participante revela sua decisão, o laboratório calcula entropia cruzada, gradientes por diferenciação automática e atualiza os pesos em 6 passos de descida do gradiente.

É uma rede pequena e didática, não um sistema de recomendação de transporte.

## Variáveis da Vercel

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave
```

Use a chave **publishable**, nunca `service_role`. O login reutiliza a função `public.pulso_is_admin()` já usada nos outros laboratórios. A sessão é persistida pelo cliente Supabase. O Realtime Broadcast sincroniza as telas e existe fallback por `BroadcastChannel` entre abas do mesmo navegador.

As variáveis são incorporadas pelo Vite durante o build e também disponibilizadas por `/api/config` em runtime. Essa segunda rota evita que um build estático antigo deixe o laboratório permanentemente no fallback. Alterações de variáveis na Vercel exigem um novo deployment.

## Desenvolvimento

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm run build
npm run preview
```
