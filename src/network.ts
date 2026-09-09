import * as tf from '@tensorflow/tfjs'

export const FEATURES = [
  { key: 'distance', label: 'Distância', unit: 'km', min: 0.5, max: 30 },
  { key: 'rain', label: 'Chance de chuva', unit: '%', min: 0, max: 100 },
  { key: 'urgency', label: 'Pressa', unit: '%', min: 0, max: 100 },
  { key: 'cargo', label: 'Coisas para levar', unit: '%', min: 0, max: 100 },
  { key: 'economy', label: 'Prioridade: economizar', unit: '%', min: 0, max: 100 },
  { key: 'transit', label: 'Transporte público disponível', unit: '', min: 0, max: 1 },
] as const

export const CHOICES = [
  { id: 'walk', label: 'A pé', icon: '🚶' },
  { id: 'bike', label: 'Bicicleta', icon: '🚲' },
  { id: 'transit', label: 'Transporte público', icon: '🚌' },
  { id: 'car', label: 'Carro ou aplicativo', icon: '🚗' },
] as const

export type ChoiceId = typeof CHOICES[number]['id']
export type Scenario = { distance: number; rain: number; urgency: number; cargo: number; economy: number; transit: number }
export type Trace = {
  normalized: number[]
  hidden1Sums: number[]
  hidden1: number[]
  hidden2Sums: number[]
  hidden2: number[]
  logits: number[]
  probabilities: number[]
  predicted: ChoiceId
}
export type LearningTrace = {
  expected: ChoiceId
  before: Trace
  after: Trace
  lossBefore: number
  lossAfter: number
  gradient: number
  weightBefore: number
  weightAfter: number
  learningRate: number
  connection: string
}

export const DEFAULT_SCENARIO: Scenario = { distance: 7, rain: 25, urgency: 55, cargo: 20, economy: 70, transit: 1 }

export function normalizeScenario(s: Scenario) {
  return [s.distance / 30, s.rain / 100, s.urgency / 100, s.cargo / 100, s.economy / 100, s.transit]
}

const h1Names = ['perto', 'tempo seco', 'pressa', 'carga leve', 'economia', 'transporte disponível', 'esforço possível', 'conforto']
const h2Names = ['caminhar', 'pedalar', 'usar transporte', 'usar carro', 'baixo custo', 'rapidez']
export const LAYER_LABELS = [['Distância', 'Chuva', 'Pressa', 'Carga', 'Economia', 'Transporte'], h1Names, h2Names, CHOICES.map((c) => c.label)]

class ClassroomNetwork {
  private w1 = tf.variable(tf.tensor2d([
    [-2.8, -0.3, 0.2, -1.4, 0.1, 0.0, -2.1, 0.5],
    [-0.2, -2.4, 0.4, -0.4, 0.0, 0.1, -1.3, 1.8],
    [-0.4, 0.0, 2.3, -0.2, -0.2, -0.2, -0.6, 1.0],
    [-0.4, 0.0, 0.3, -2.1, 0.0, 0.1, -1.5, 1.6],
    [0.2, 0.1, -0.2, 0.2, 2.4, 0.5, 1.0, -0.5],
    [0.0, 0.0, -0.1, 0.0, 0.4, 2.8, 0.1, 0.2],
  ]), true, 'w1')
  private b1 = tf.variable(tf.tensor1d([1.25, 1.0, -0.55, 1.05, -0.45, -1.1, 1.3, -0.25]), true, 'b1')
  private w2 = tf.variable(tf.tensor2d([
    [1.8, 1.1, -0.2, -0.5, 0.8, -0.3], [1.0, 1.7, 0.1, -0.5, 0.3, 0.0],
    [-0.8, 0.1, 0.8, 1.7, -0.4, 2.0], [0.7, 1.0, -0.1, -0.7, 0.4, -0.2],
    [0.8, 0.5, 1.7, -0.4, 2.1, -0.3], [-0.5, -0.2, 2.4, -0.3, 0.8, 0.8],
    [1.5, 1.3, 0.2, -0.8, 0.6, -0.2], [-0.7, -0.2, 0.6, 2.0, -0.6, 1.0],
  ]), true, 'w2')
  private b2 = tf.variable(tf.tensor1d([-0.8, -0.75, -0.7, -0.8, -0.6, -0.65]), true, 'b2')
  private w3 = tf.variable(tf.tensor2d([
    [2.2, 0.5, -0.5, -0.8], [0.2, 2.2, -0.3, -0.5], [-0.4, -0.4, 2.4, 0.3],
    [-0.8, -0.4, -0.1, 2.4], [0.8, 0.4, 1.1, -0.5], [-0.5, 0.2, 0.6, 1.3],
  ]).mul(.1), true, 'w3')
  private b3 = tf.variable(tf.tensor1d([0.1, 0.05, 0.1, 0.05]), true, 'b3')
  readonly learningRate = 0.012

  private forward(input: tf.Tensor2D) {
    const z1 = input.matMul(this.w1).add(this.b1) as tf.Tensor2D
    const a1 = z1.relu() as tf.Tensor2D
    const z2 = a1.matMul(this.w2).add(this.b2) as tf.Tensor2D
    const a2 = z2.relu() as tf.Tensor2D
    const logits = a2.matMul(this.w3).add(this.b3) as tf.Tensor2D
    return { z1, a1, z2, a2, logits, probabilities: logits.softmax() as tf.Tensor2D }
  }

  predict(scenario: Scenario): Trace {
    return tf.tidy(() => {
      const normalized = normalizeScenario(scenario)
      const values = this.forward(tf.tensor2d([normalized]))
      const row = (tensor: tf.Tensor2D) => (tensor.arraySync() as number[][])[0]
      const probabilities = row(values.probabilities)
      const selected = probabilities.indexOf(Math.max(...probabilities))
      return { normalized, hidden1Sums: row(values.z1), hidden1: row(values.a1), hidden2Sums: row(values.z2), hidden2: row(values.a2), logits: row(values.logits), probabilities, predicted: CHOICES[selected].id }
    })
  }

  influencePath(scenario: Scenario, featureIndex: number) {
    const trace = this.predict(scenario)
    const strongest = (values: number[]) => values.reduce((best, value, index) => Math.abs(value) > Math.abs(values[best]) ? index : best, 0)
    const row = (values: ArrayLike<number>, columns: number, index: number) => Array.from({ length: columns }, (_, offset) => values[index * columns + offset])
    const input = Math.max(0, Math.min(trace.normalized.length - 1, featureIndex))
    const hidden1 = strongest(row(this.w1.dataSync(), 8, input).map((weight) => trace.normalized[input] * weight))
    const hidden2 = strongest(row(this.w2.dataSync(), 6, hidden1).map((weight) => trace.hidden1[hidden1] * weight))
    const output = strongest(row(this.w3.dataSync(), 4, hidden2).map((weight) => trace.hidden2[hidden2] * weight))
    return [input, hidden1, hidden2, output]
  }

  train(scenario: Scenario, expected: ChoiceId): LearningTrace {
    const before = this.predict(scenario)
    const target = CHOICES.findIndex((choice) => choice.id === expected)
    let firstGradient = 0
    let weightBefore = 0
    let weightAfter = 0
    for (let epoch = 0; epoch < 6; epoch += 1) {
      const grads = tf.variableGrads(() => tf.tidy(() => {
        const { logits } = this.forward(tf.tensor2d([normalizeScenario(scenario)]))
        return tf.losses.softmaxCrossEntropy(tf.oneHot(tf.tensor1d([target], 'int32'), CHOICES.length), logits).mean()
      }))
      const w3Grad = grads.grads.w3
      if (epoch === 0 && w3Grad) {
        const values = w3Grad.dataSync()
        let strongest = 0
        for (let index = 1; index < values.length; index += 1) if (Math.abs(values[index]) > Math.abs(values[strongest])) strongest = index
        firstGradient = values[strongest]
        const weights = this.w3.dataSync()
        weightBefore = weights[strongest]
      }
      ;[this.w1, this.b1, this.w2, this.b2, this.w3, this.b3].forEach((variable) => {
        const gradient = grads.grads[variable.name]
        if (gradient) tf.tidy(() => variable.assign(variable.sub(gradient.mul(this.learningRate))))
      })
      Object.values(grads.grads).forEach((gradient) => gradient.dispose())
      grads.value.dispose()
    }
    const after = this.predict(scenario)
    weightAfter = weightBefore - this.learningRate * firstGradient
    return {
      expected, before, after,
      lossBefore: -Math.log(Math.max(before.probabilities[target], 1e-7)),
      lossAfter: -Math.log(Math.max(after.probabilities[target], 1e-7)),
      gradient: firstGradient, weightBefore, weightAfter,
      learningRate: this.learningRate, connection: `neurônio oculto → ${CHOICES[target].label}`,
    }
  }
}

export const classroomNetwork = new ClassroomNetwork()

export function choiceLabel(id: ChoiceId) { return CHOICES.find((choice) => choice.id === id)?.label || id }
