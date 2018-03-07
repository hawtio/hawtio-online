namespace Online {

  export class HttpSrcDirective implements ng.IDirective {

    scope: {
      httpSrc: '@';
    };

    constructor(private $http) {
      'ngInject';
    }

    link($scope, elem, attrs) {
      function revokeObjectURL() {
        if ($scope.objectURL) {
          URL.revokeObjectURL($scope.objectURL);
        }
      }

      $scope.$watch('objectURL', function (objectURL) {
        elem.attr('src', objectURL);
      });

      $scope.$on('$destroy', function () {
        revokeObjectURL();
      });

      attrs.$observe('httpSrc', (url: string) => {
        revokeObjectURL();

        if (url && url.indexOf('data:') === 0) {
          $scope.objectURL = url;
        } else if (url) {
          this.$http
            .get(url, {
              responseType : 'arraybuffer',
              cache        : true,
              headers      : {
                accept : 'image/webp,image/*,*/*;q=0.8',
              }
            })
            .then(function (response) {
              const contentType = response.headers('Content-Type');
              if (!contentType || !contentType.startsWith('image/')) {
                throw Error(`Invalid content type '${contentType}' for URL '${url}'`);
              }
              const blob = new Blob([response.data], {
                type : response.headers('Content-Type'),
              });
              $scope.objectURL = URL.createObjectURL(blob);
            })
            .catch(error => {
              $scope.objectURL = 'img/java.svg';
            });
        }
      });
    }
  }
}
