let Resolver = require('./resolver');
let Required = require('./required');
let Dependencies = require('./dependencies');

/**
 * A module for analyzing javascript source files to produce a tree
 * of dependencies based on the requirement calls within them
 * @module cartographer
 */
class Cartographer {
    constructor(options = {}) {
        this.resolver     = options.resolver     || new Resolver(options.resolverOptions);
        this.dependencies = options.dependencies || new Dependencies({
            resolver : this.resolver
        });
    }

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
    analyze(fileName, cb) {
        this.resolver.resolve(fileName, (err, file) => {
            if(err || !file) {
                return cb(err || `File not found: ${fileName}`);
            }

            this.dependencies.analyze(file, (err) => {
                cb(err, err ? null : file)
            });
        });
    };
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

module.exports = Cartographer;
