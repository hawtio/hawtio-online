/// <reference types="angular" />
declare namespace Online {
    class DiscoverController {
        private $scope;
        private $window;
        private pfViewUtils;
        private K8SClientFactory;
        private jsonpath;
        _loading: number;
        pods: any[];
        filteredPods: any[];
        projects: any[];
        toolbarConfig: any;
        viewType: any;
        constructor($scope: any, $window: any, pfViewUtils: any, K8SClientFactory: any, jsonpath: any);
        $onInit(): void;
        loading(): boolean;
        open(url: any): boolean;
        getStatusClasses(pod: any, status: any): string;
    }
}
declare namespace Online {
    class HttpSrcDirective implements ng.IDirective {
        private $http;
        scope: {
            httpSrc: '@';
        };
        constructor($http: any);
        link($scope: any, elem: any, attrs: any): void;
    }
}
declare namespace Online {
    class MatchHeightDirective implements ng.IDirective {
        private $timeout;
        restrict: 'A';
        constructor($timeout: any);
        link(scope: any, _: any): void;
    }
}
declare namespace Online {
    const labelsModule: angular.IModule;
}
declare namespace Online {
    const statusModule: angular.IModule;
}
declare namespace Online {
    const discoverModule: angular.IModule;
}
declare namespace Online {
    const log: Logging.Logger;
}
declare namespace Online {
    function isPodReady(pod: any): any;
}
