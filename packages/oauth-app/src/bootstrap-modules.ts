export async function bootstrapModules() {
  // Use Promise.all to fetch all modules concurrently
  const [hawtioReactMod, hawtioUiMod, oAuthMod] = await Promise.all([
    import('@hawtio/react'),
    import('@hawtio/react/ui'),
    import('@hawtio/online-oauth'),
  ])

  return {
    hawtioreact: hawtioReactMod,
    hawtioUi: hawtioUiMod,
    oAuth: oAuthMod,
  }
}
