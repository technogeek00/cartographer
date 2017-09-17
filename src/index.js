var Resolver = require('./resolver');
var Required = require('./required');
var Dependencies = require('./dependencies');

/**
 * A module for analyzing javascript source files to produce a tree
 * of dependencies based on the requirement calls within them
 * @module cartographer
 */
function Cartographer(options) {
    options = options || {}
    this.resolver = options.resolver || new Resolver(options.resolverOptions);
    this.dependencies = options.dependencies || new Dependencies({
        resolver : this.resolver
    });
}

/**
 * The module resolver class used by cartographer
 * @see module:cartographer/resolver
 */
Cartographer.Resolver = Resolver;

/**
 * The requirement analysis class used by cartographer
 * @see module:cartographer/required
 */
Cartographer.Required = Required;

/**
 * The dependency resolver class used by cartographer
 * @see  module:cartographer/dependencies
 */
Cartographer.Dependencies = Dependencies;

/**
 * This callback is executed at the completion of a dependency analysis
 * cycle. If a fatal error occurs during analysis it will be handed to
 * this callback as the first argument, if the analysis is able to complete
 * the file corresponding to the filename originally given to analyze will
 * be given to the callback as a Vinyl file with an additional 'dependencies'
 * attribute that contains the calculated dependencies
 * @note it is possible for errors to occur during the resolution of dependencies
 *       that are not fatal errors, the dependency will be marked as an error if
 *       such one occurs
 * @param {Error} err   A fatal error that occurred during analysis
 * @param {Vinyl} file  The vinyl file corresponding to the given file name
 */

/**
 * Takes the given file name and attempts to produce a complete
 * dependency tree based on the require calls within that file
 * and any subsequently required files.
 * @param  {String}                       fileName The file to find dependencies from
 * @param  {Cartographer~analyzeCallback} cb       A function to call when analysis is complete
 */
Cartographer.prototype.analyze = function(fileName, cb) {
    var that = this;
    this.resolver.resolve(fileName, function(err, file) {
        if(err || !file) {
            err = err || "File not found: " + fileName;
            return cb(err);
        }

        that.dependencies.analyze(file, function(err) {
            if(err) {
                return cb(err);
            }
            return cb(null, file);
        });
    });
};

module.exports = Cartographer;
