namespace Online {

  export class ConsoleService {

    private _url: string;

    constructor(private $http: ng.IHttpService) {
      'ngInject';
      $http({
        method : 'GET',
        url    : new URI().query('').path('/console').toString(),
      }).then(response => {
        this._url = response.headers('location');
        log.debug('Using OpenShift Web console URL:', this._url);
      }, error => {
        log.debug('Unable to retrieve OpenShift Web console URL');
      });
    }

    get url(): string {
      return this._url;
    }
  }
}
