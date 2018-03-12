/// <reference path="about.component.ts"/>

namespace Online {

  const aboutModule = angular
    .module('hawtio-online-about', [])
    .run(configureMenu)
    .component('about', aboutComponent);

  function configureMenu(HawtioExtension: Core.HawtioExtension, $compile: ng.ICompileService) {
    'ngInject';
    HawtioExtension.add('hawtio-about', $scope => {
      const template = `
        <a ng-init="flags = {open: false}" ng-click="flags.open = true">About</a>
        <about flags="flags"></about>
      `;
      return $compile(template)($scope);
    });
  }

  hawtioPluginLoader.addModule(aboutModule.name);
}
