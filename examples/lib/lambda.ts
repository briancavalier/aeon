import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'

export const invoke = <F extends (a: any) => Promise<unknown> = never>(c: LambdaClient, name: string) =>
  async (a: Parameters<F>[0]): Promise<Awaited<ReturnType<F>>> => {
    const result = await c.send(new InvokeCommand({ FunctionName: name, Payload: JSON.stringify(a) }))
    if (result.FunctionError) {
      const { errorMessage, trace } = JSON.parse(new TextDecoder().decode(result.Payload))
      throw new InvokeError(`Remote lambda error: ${name}`, {
        cause: { message: errorMessage, stack: `[${name}] ${trace.join('\n')}` }
      })
    }

    if (result.Payload) return JSON.parse(new TextDecoder().decode(result.Payload))
    return undefined as Awaited<ReturnType<F>>
  }

export class InvokeError extends Error {
  name = 'InvokeError'
}
