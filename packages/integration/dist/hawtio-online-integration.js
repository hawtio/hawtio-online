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
    hawtioPluginLoader.registerPreBootstrapTask({
        name: 'HawtioTabTitle',
        depends: 'ConfigLoader',
        task: function (next) {
            document.title = _.get(window, 'hawtconfig.branding.appName', 'Hawtio Console');
            next();
        }
    });
    Online.log = Logger.get(module.name);
})(Online || (Online = {}));
