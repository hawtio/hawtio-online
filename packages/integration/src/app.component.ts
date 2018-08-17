namespace Online {

  export class AppController {
    loading = true;

    constructor(private initService: Init.InitService) {
      'ngInject';
    }

    $onInit() {
      this.initService.init()
        .then(() => this.loading = false);
    }
  }

  export const appComponent: angular.IComponentOptions = {
    template: `
      <hawtio-loading loading="$ctrl.loading">
        <hawtio-integration-nav></hawtio-integration-nav>
      </hawtio-loading>
    `,
    controller: AppController,
  };
}
