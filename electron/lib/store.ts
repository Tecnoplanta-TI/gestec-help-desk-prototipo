import Store from 'electron-store'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StoreOptions<T extends Record<string, any>> = ConstructorParameters<typeof Store<T>>[0] & {
  projectName?: string
}

/** electron-store com projectName para execução fora do Electron (modo navegador). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAppStore<T extends Record<string, any> = Record<string, any>>(
  options: StoreOptions<T> = {} as StoreOptions<T>,
): Store<T> {
  return new Store<T>({
    projectName: 'gestec-help-desk',
    ...options,
  } as ConstructorParameters<typeof Store<T>>[0])
}
