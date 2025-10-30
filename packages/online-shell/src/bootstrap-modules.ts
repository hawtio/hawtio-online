const modulesToLoad = {
  hawtioreact: () => import('@hawtio/react'),
  oAuth: () => import('@hawtio/online-oauth'),
  kube: () => import('@hawtio/online-kubernetes-api'),
  mgmt: () => import('@hawtio/online-management-api'),

  // ::hawtio-additional-modules:: // Build-time hook for sed/awk to add additional modules
}

// -----------------------------------------------------------------
// (No need to edit below this line)
// -----------------------------------------------------------------

/**
 * The HawtioBootstrapModules type is dynamically generated
 * from the keys and promise-types defined in 'modulesToLoad'.
 */
export type HawtioBootstrapModules = {
  [K in keyof typeof modulesToLoad]: Awaited<ReturnType<(typeof modulesToLoad)[K]>>
}

/**
 * The bootstrapModules function is now fully dynamic.
 * It iterates over 'modulesToLoad' and handles all modules
 * defined there, without needing its code to be changed.
 */
export async function bootstrapModules(): Promise<HawtioBootstrapModules> {
  // Get an array of [key, loaderFunc] pairs
  // (TypeScript types this as [string, () => Promise<any>][])
  const entries = Object.entries(modulesToLoad)

  // Map them to an array of new promises.
  // Each promise will resolve to a [key, resolvedModule] tuple.
  const promises = entries.map(async ([key, load]) => {
    const module = await load()
    return [key, module] as const // 'as const' helps TS track the pair
  })

  // Wait for all [key, module] pairs to resolve
  const resolvedPairs = await Promise.all(promises)

  // Convert the array of [key, module] pairs back into an object.
  // We apply one (safe) type cast at the end.
  return Object.fromEntries(resolvedPairs) as HawtioBootstrapModules
}
