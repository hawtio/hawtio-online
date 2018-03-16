var Online;
(function (Online) {
    addLogoutToUserDropdown.$inject = ["HawtioExtension", "$compile", "userDetails"];
    var module = angular
        .module('hawtio-online-integration', [])
        .run(addLogoutToUserDropdown);
    function addLogoutToUserDropdown(HawtioExtension, $compile, userDetails) {
        'ngInject';
        HawtioExtension.add('hawtio-logout', function ($scope) {
            $scope.userDetails = userDetails;
            var template = '<a href="" ng-click="userDetails.logout()">Logout</a>';
            return $compile(template)($scope);
        });
    }
    hawtioPluginLoader.addModule(module.name);
    Online.log = Logger.get(module.name);
})(Online || (Online = {}));
