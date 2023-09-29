import Logger from "js-logger"

export const pluginName = 'KubernetesAPI'
export const log = Logger.get('hawtio-management-api')

/*
 * States emitted by the Management Service
 */
export enum MgmtActions {
  UPDATED = 'UPDATED',
}
