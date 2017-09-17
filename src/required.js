var path = require('path');
var File = require('vinyl');
var esprima = require('esprima');

/**
 * The description of a require call that has been located in a source file
 * @typedef {Object} Requirement
 * @property {Boolean} static Whether or not the requirement is statically declared
 * @property {String} path The literal source that makes up the requirement call
 * @property {Reference[]} references An array of different references to the same
 *                                    requirement throughout the source
 */

/**
 * A specific code reference for a requirement call
 * @typedef {Object} Reference
 * @property {String} source The literal source that made up the requirement call argument
 * @property {Object} position The position within the file the source is extracted from
 * @property {Object} position.start The start index of the source string in the file
 * @property {Object} position.end The end index of the source string in the file
 */

/**
 * This module provides the ability to analyze source code and find all
 * of the require calls that occur within it
 * @module cartographer/required
 */
Required = module.exports

/**
 * A helper method to grab a specific portion of the source
 * @param  {String} source A source string to pull data from
 * @param  {Number[]} range Two numbers in an array, the first specifying the
 *                          start index within the source, the second the end
 * @return {String} The source substring specified by the given range
 */
function grabSource(source, range) {
    return source.substring(range[0], range[1]);
}

/**
 * A helper method that analyzes CallExpression nodes to find out if they
 * are require calls and if they are track the requirement
 * @param  {String} source   The source that is currently being traversed
 * @param  {Object} required An object to track requirements found within the
 *                           source AST, stored as source => Requirement
 * @param  {Object} node     A CallExpression node in the tree
 * @param  {Object} metadata  Metadata about the node given to this method
 */
function trackRequirement(source, required, node, metadata) {
    var callee = node.callee;
    var args = node.arguments;

    if(callee.type != "Identifier" || callee.name != "require" || args.length != 1) {
        return;
    }

    var first = args[0];
    var staticRequire = first.type == "Literal";
    var path = grabSource(source, first.range);

    // cleanup static paths since they will likely further resolve
    if(staticRequire) {
        path = path.substring(1, path.length - 1);
    }

    required[path] = required[path] || {
        references : [],
        path : path,
        static : staticRequire
    };

    required[path].references.push({
        source : grabSource(source, node.range),
        position : {
            start : node.range[0],
            end : node.range[1]
        }
    });
}

/**
 * Takes a node from the syntax parser and dispatches it to
 * the function matching the node type name
 * @param  {Object} handlers An object whose keys are node types and values are functions
 *                           that will be executed when that node type is encountered
 * @param  {[type]} node     The node the parser is currently constructing
 * @param  {[type]} metadata The metadata about the node being constructed
 */
function nodeDispatch(handlers, node, metadata) {
    if(handlers[node.type]) {
        handlers[node.type](node, metadata);
    }
}

/**
 * This method takes a Vinyl file and finds all the require calls
 * within the source it contains
 * @param  {Vinyl} file A vinyl file to analyze
 * @return {Requirement[]} An array of requirements found within the file
 *                         the entries will be unique if the call parameters
 *                         have the exact same source, no attempt is made to
 *                         interpret call arguments.
 */
Required.analyze = function(file) {
    if(!File.isVinyl(file) || file.isNull()) {
        return null;
    }
    // get a string representation of the file to parse
    var source = file.contents.toString();

    // variables used to collect the requirement information within the module
    var required = {};
    var handler = {
        CallExpression : trackRequirement.bind(null, source, required)
    };

    // parse the file as a module, scripts are not currently supported
    var parserOptions = {
        range : true
    };
    esprima.parseModule(source, parserOptions, nodeDispatch.bind(null, handler));

    // convert response to an array
    var trimed = [];
    for(var path in required) {
        trimed.push(required[path]);
    }

    return trimed;
}
