export type HawtioBootstrapModules = {
  hawtioreact: typeof import('@hawtio/react')
  oAuth: typeof import('@hawtio/online-oauth')
  kube: typeof import('@hawtio/online-kubernetes-api')
}

export async function bootstrapModules(): Promise<HawtioBootstrapModules> {
  // Use Promise.all to fetch all modules concurrently
  const [hawtioReactMod, oAuthMod, kubeMod] = await Promise.all([
    import('@hawtio/react'),
    import('@hawtio/online-oauth'),
    import('@hawtio/online-kubernetes-api'),
  ])

  return {
    hawtioreact: hawtioReactMod,
    oAuth: oAuthMod,
    kube: kubeMod,
  }
}
