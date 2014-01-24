var u = require('util'),
    path = require('path'),

    vow = require('vow'),
    fs = require('vow-fs'),
    _ = require('lodash'),
    sha = require('sha1'),
    susanin = require('susanin'),

    util = require('../util'),
    logger = require('../logger')(module),
    config = require('../config'),
    leData = require('./le-data');

var sitemap,
    routes = {};

module.exports = {
    run: function() {
        logger.info('Init site structure and load data');

        leData.init();

        return load()
            .then(parse)
            .then(process)
            .then(leData.loadAll)
    },

    /**
     * Returns array of objects for susanin routes creation
     * @returns {Array}
     */
    getRoutes: function() {
        return _.values(routes);
    },

    /**
     * Returns parsed and post-processed sitemap model
     * @returns {Object}
     */
    getSitemap: function() {
        return sitemap;
    }
};

/**
 * Load sitemap file from filesystem
 * @returns {String} - content of sitemap.json file
 */
var load = function() {
    logger.debug('Load site map');

    return fs
        .read(path.join('configs', 'common', 'sitemap.json'), 'utf-8')
        .fail(
            function(err) {
                logger.error('Site map loading failed with error %s', err.message);
            }
        );
};

/**
 * Parse content of sitemap json file to js object and handle errors
 * @param data - content of sitemap.json file
 * @returns {Object} parsed sitemap object
 */
var parse = function(data) {
    logger.debug('Parse site map');

    var def = vow.defer();

    try {
        sitemap = JSON.parse(data);
        def.resolve(sitemap);
    } catch(err) {
        logger.error('Site map parsed with error %s', err.message);
        def.reject(err);
    }

    return def.promise();
};

var process = function(sitemap) {
    logger.debug('Process site map');

    var def = vow.defer(),
        idSourceMap = {},

        /**
         * Creates hash unique id of node -> source
         * @param node {Object} - single node of sitemap model
         */
        processSource = function(node) {
            if(_.has(node, 'source')) {
                idSourceMap[node.id] = node.source;
            }
        },

        /**
         * Makes title consistent
         * @param node {Object} - single node of sitemap model
         */
        processTitle = function(node) {
            if(_.has(node, 'title')) {
                if(_.isString(node.title)) {
                    node.title = {
                        en: node.title,
                        ru: node.title
                    }
                }
            }
        },

        /**
         * Select view for node
         * @param node {Object} - single node of sitemap model
         */
        processView = function(node) {
            if(!_.has(node, 'view')) {
                node.view = _.has(node, 'source') ? 'post' : 'posts'
            }
        },

        /**
         * Collects routes rules for nodes
         * @param node {Object} - single node of sitemap model
         */
        processRoute = function(node) {
            node.params = node.parent.params;

            if(_.has(node, 'route') && _.isObject(node.route)) {
                var r = node.route;

                if(_.has(r, 'name')) {
                    routes[r.name] = routes[r.name] || { name: r.name, pattern: r.pattern };
                    node.url = susanin.Route(routes[r.name]).build(node.params);
                }else {
                    r.name = node.parent.route.name;
                }

                ['defaults', 'conditions', 'data'].forEach(function(item) {
                    routes[r.name][item] = routes[r.name][item] || {};

                    if(_.has(r, item)) {
                        _.keys(r[item]).forEach(function(key) {
                            if(item === 'conditions') {
                                routes[r.name][item][key] = routes[r.name][item][key] || [];
                                routes[r.name][item][key].push(r[item][key]);

                                node.url = susanin.Route(routes[r.name]).build(_.extend(node.params, r[item]));
                            }else {
                                routes[r.name][item][key] = r[item][key];
                            }
                        });
                    }
                });

                logger.silly('url = %s', node.url);

                processView(node);
            }else {
                node.route = {name: node.parent.route.name};
            }
        },

        /**
         * Recursive function for traversing tree model
         * @param node {Object} - single node of sitemap model
         * @param parent {Object} - parent for current node
         */
        nodeR = function(node, parent) {

            node.id = sha(JSON.stringify(node)); //generate unique id for node as sha sum of node object
            node.parent = parent; //set parent for current node

            processRoute(node);
            processTitle(node);
            processSource(node);

            //deep into node items
            if(_.has(node, 'items')) {
                node.items.forEach(function(item) {
                    nodeR(item, node);
                });
            }
        };

    try {
        sitemap.forEach(function(item) {
            nodeR(item, {
                route: {name: null},
                params: {}
            });
        });

        leData.setIdHash(idSourceMap);
        def.resolve(sitemap);
    } catch(e) {
        logger.error(e.message);
        def.reject(e);
    }

    return def.promise();
};
