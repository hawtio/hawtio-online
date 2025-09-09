export type HawtioBootstrapModules = {
  hawtioreact: typeof import('@hawtio/react')
  oAuth: typeof import('@hawtio/online-oauth')
}

export async function bootstrapModules(): Promise<HawtioBootstrapModules> {
  // Use Promise.all to fetch all modules concurrently
  const [hawtioReactMod, oAuthMod] = await Promise.all([import('@hawtio/react'), import('@hawtio/online-oauth')])

  return {
    hawtioreact: hawtioReactMod,
    oAuth: oAuthMod,
  }
}
