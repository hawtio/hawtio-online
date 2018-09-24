namespace Online {

  const log = Logger.get('hawtio-online-openshift');

  export class ConsoleService {

    private _response: ng.IPromise<string|undefined>;

    constructor($http: ng.IHttpService) {
      'ngInject';
      this._response = $http({
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

    get url(): ng.IPromise<string|undefined> {
      return this._response;
    }
  }
}
