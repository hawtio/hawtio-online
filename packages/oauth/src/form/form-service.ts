import { OAuthProtoService } from "../globals"


export class FormService implements OAuthProtoService {
  isActive(): Promise<boolean> {
    throw new Error("Method not implemented.")
  }
  registerUserHooks(): void {
    throw new Error("Method not implemented.")
  }

}
