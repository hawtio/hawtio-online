export type HawtioBootstrapModules = {
  hawtioreact: typeof import('@hawtio/react')
  oAuth: typeof import('@hawtio/online-oauth')
  kube: typeof import('@hawtio/online-kubernetes-api')
  mgmt: typeof import('@hawtio/online-management-api')
}

export async function bootstrapModules(): Promise<HawtioBootstrapModules> {
  // Use Promise.all to fetch all modules concurrently
  const [hawtioReactMod, oAuthMod, kubeMod, mgmtMod] = await Promise.all([
    import('@hawtio/react'),
    import('@hawtio/online-oauth'),
    import('@hawtio/online-kubernetes-api'),
    import('@hawtio/online-management-api'),
  ])

  return {
    hawtioreact: hawtioReactMod,
    oAuth: oAuthMod,
    kube: kubeMod,
    mgmt: mgmtMod,
  }
}
