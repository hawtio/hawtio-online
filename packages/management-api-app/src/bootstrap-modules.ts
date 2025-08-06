export async function bootstrapModules() {
  // Use Promise.all to fetch all modules concurrently
  const [hawtioReactMod, hawtioUiMod, oAuthMod, kubeMod, mgmtMod] = await Promise.all([
    import('@hawtio/react'),
    import('@hawtio/react/ui'),
    import('@hawtio/online-oauth'),
    import('@hawtio/online-kubernetes-api'),
    import('@hawtio/online-management-api'),
  ])

  return {
    hawtioreact: hawtioReactMod,
    hawtioUi: hawtioUiMod,
    oAuth: oAuthMod,
    kube: kubeMod,
    mgmt: mgmtMod,
  }
}
