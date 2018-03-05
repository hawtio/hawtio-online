/// <reference path="onlinePlugin.ts"/>

module Online {

  angular.module(pluginName)
    .directive('durationUntilNow', function() {
      return {
        restrict : 'E',
        scope    : {
          timestamp  : '=',
          omitSingle : '=?',
          precision  : '=?'
        },
        template : '<span data-timestamp="{{timestamp}}" data-omit-single="{{omitSingle}}" data-precision="{{precision}}" class="duration">{{timestamp | duration : null : omitSingle : precision}}</span>'
      };
    }
  )

  .filter('duration', function() {
    return function(timestampLhs, timestampRhs, omitSingle, precision) {
      if (!timestampLhs) {
        return timestampLhs;
      }
      precision = precision || 2;
      timestampRhs = timestampRhs || new Date(); // moment expects either an ISO format string or a Date object

      var ms = moment(timestampRhs).diff(timestampLhs);
      if (ms < 0) {
        // Don't show negative durations
        ms = 0;
      }
      var duration = moment.duration(ms);
      // the out of the box humanize in moment.js rounds to the nearest time unit
      // but we need more details
      var humanizedDuration = [];
      var years = duration.years();
      var months = duration.months();
      var days = duration.days();
      var hours = duration.hours();
      var minutes = duration.minutes();
      var seconds = duration.seconds();

      function add(count, singularText, pluralText) {
        if (count === 0) {
          return;
        }

        if (count === 1) {
          if (omitSingle) {
            humanizedDuration.push(singularText);
          } else {
            humanizedDuration.push('1 ' + singularText);
          }

          return;
        }

        humanizedDuration.push(count + ' ' + pluralText);
      }

      add(years, 'year', 'years');
      add(months, 'month', 'months');
      add(days, 'day', 'days');
      add(hours, 'hour', 'hours');
      add(minutes, 'minute', 'minutes');
      add(seconds, 'second', 'seconds');

      // If precision is 1, we're showing rough values. Don't show values less
      // than a minute.
      // TODO: Is there ever a time we want precision = 1 and to show seconds?
      if (humanizedDuration.length === 1 && seconds && precision === 1) {
        if (omitSingle) {
          return 'minute';
        }

        return '1 minute';
      }

      if (humanizedDuration.length === 0) {
        humanizedDuration.push('0 seconds');
      }

      if (humanizedDuration.length > precision) {
        humanizedDuration.length = precision;
      }

      return humanizedDuration.join(', ');
    };
  });
}
