namespace Online {

  const log = Logger.get('hawtio-online-openshift');

  export class ConsoleService {

    private _url: ng.IPromise<string | undefined>;

    constructor(
      $http: ng.IHttpService,
      $window: ng.IWindowService,
      $q: ng.IQService,
    ) {
      'ngInject';
      const url = $window.OPENSHIFT_CONFIG.openshift.web_console_url;
      if (url) {
        this._url = $q.resolve(url);
      } else {
        this._url = $http({
          method : 'GET',
          url    : new URI().query('').path('/console').valueOf(),
        }).then(response => {
          const url = response.headers('location');
          log.debug('Using OpenShift Web console URL:', url);
          return response.headers('location');
        }, error => {
          log.debug('Unable to retrieve OpenShift Web console URL');
          return undefined;
        });
      }
    }

    get url(): ng.IPromise<string | undefined> {
      return this._url;
    }
  }
}
