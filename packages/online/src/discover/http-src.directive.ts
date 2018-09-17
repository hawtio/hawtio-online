namespace Online {

  export interface HttpSrcDirectiveScope extends ng.IScope {
    objectURL: string;
  }

  export class HttpSrcDirective implements ng.IDirective {

    scope: {
      httpSrc: '@';
    };

    constructor(private $http: ng.IHttpService) {
      'ngInject';
    }

    link(scope: HttpSrcDirectiveScope, elem: JQuery, attrs: ng.IAttributes) {
      function revokeObjectURL() {
        if (scope.objectURL) {
          URL.revokeObjectURL(scope.objectURL);
        }
      }

      scope.$watch('objectURL', function (objectURL: string) {
        elem.attr('src', objectURL);
      });

      scope.$on('$destroy', function () {
        revokeObjectURL();
      });

      attrs.$observe('httpSrc', (url: string) => {
        revokeObjectURL();

        if (url && url.indexOf('data:') === 0) {
          scope.objectURL = url;
        } else if (url) {
          this.$http
            .get<ArrayBuffer>(url, {
              responseType : 'arraybuffer',
              cache        : true,
              headers      : {
                accept : 'image/webp,image/*,*/*;q=0.8',
              }
            })
            .then(function (response) {
              const contentType = response.headers('Content-Type');
              if (!contentType || !_.startsWith(contentType, 'image/')) {
                throw Error(`Invalid content type '${contentType}' for URL '${url}'`);
              }
              const blob = new Blob([response.data], {
                type : response.headers('Content-Type'),
              });
              scope.objectURL = URL.createObjectURL(blob);
            })
            .catch(_ => {
              scope.objectURL = 'img/java.svg';
            });
        }
      });
    }
  }
}
