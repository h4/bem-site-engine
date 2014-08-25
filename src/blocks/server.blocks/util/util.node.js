var path = require('path'),

    _ = require('lodash'),
    vow = require('vow');

modules.define('util', ['constants', 'config'], function(provide, constants, config) {

    provide({

        /**
         * Checks if current environment is development
         * @returns {boolean}
         */
        isDev: function() {
            return 'development' === config.get('NODE_ENV');
        },

        /**
         * Find node(s) which satisfy to criteria function
         * @param model - {Object} sitemap model object
         * @param criteria - {Function} criteria function
         * @param onlyFirst - {Boolean} flag for find only first node
         * @returns {*}
         */
        findNodesByCriteria: function(model, criteria, onlyFirst) {

            var result = [];

            if(!_.isObject(model)) {
                return result;
            }

            if(!_.isFunction(criteria)) {
                return result;
            }

            var isFound = function() {
                    return onlyFirst && result.length;
                },
                traverseTreeNodes = function(node) {
                    if(criteria.apply(node)) {
                        result.push(node);
                    }

                    if(!isFound() && node.items) {
                        node.items.forEach(function(item) {
                            traverseTreeNodes(item);
                        });
                    }
                };

            model.forEach(function(node) {
                if(isFound()) {
                    return;
                }
                traverseTreeNodes(node);
            });

            return onlyFirst ? result[0] : result;
        }
    });
});
