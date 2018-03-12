namespace Online {

  export class AboutController {
    flags: { open: boolean };
    title: string;
    productInfo: object[];
    additionalInfo: string;
    copyright: string;

    constructor(
      private configManager: Core.ConfigManager,
    ) {
      'ngInject';
    }

    $onInit() {
      this.title = this.configManager.getBrandingValue('appName');
      this.additionalInfo = this.configManager.getBrandingValue('aboutDescription');
    }

    onClose() {
      this.flags.open = false;
    }
  }

  export const aboutComponent: angular.IComponentOptions = {
    bindings: {
      flags: '<',
    },
    template: `
      <pf-about-modal is-open="$ctrl.flags.open" on-close="$ctrl.onClose()" title="$ctrl.title"
        additional-info="$ctrl.additionalInfo"></pf-about-modal>
    `,
    controller: AboutController,
  };
}
