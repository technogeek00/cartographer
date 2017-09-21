let path = require('path');
let File = require('vinyl');
let esprima = require('esprima');

/**
 * A vinyl file that has been extended to have imports and exports annotated
 * @typedef {Vinyl} DeclaredVinyl
 * @property {Import[]} imports An array of imports found during analysis
 * @property {Export[]} exports An array of exports found during analysis
 */

/**
 * The description of an import reference within the file that annotates its
 * the attributes about the import that will be needed for later cataloging and packing
 * @typedef {Object} Import
 * @property {String}      type       The type of import: 'cjs' or 'jsm'
 * @property {String}      path       The path declared in the import
 * @property {Boolean}     static     Whether or not this import appears static
 * @property {Boolean}     fixed      Whether or not this import is to a fixed file location,
 *                                    this may only be true if static is true
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
 * A regular expression used to test an import path to see if it is
 * for a fixed path or a possibly module/alias
 * @type {RegExp}
 */
const FIXED_PATH = /^(\/|\.\/|\.\.\/)/;

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
 * are CommonJS requirement calls and tracks them if they are
 * @param  {Vinyl}  file      The file that we is currently being parsed that
 *                            requirements will be tracked on
 * @param  {String} source    The source that is currently being parsed
 * @param  {Object} node      A CallExpression node in the tree
 */
function commonJsImport(file, source, node) {
    let callee = node.callee;
    let args = node.arguments;

    if(callee.type != "Identifier" || callee.name != "require" || args.length != 1) {
        return;
    }

    let first = args[0];
    let staticRequire = first.type == "Literal";
    let importPath = grabSource(source, first.range);

    // cleanup static paths since they will likely further resolve
    if(staticRequire) {
        importPath = importPath.substring(1, importPath.length - 1);
    }

    file.imports[importPath] = file.imports[importPath] || {
        type : 'cjs',
        path : importPath,
        static : staticRequire,
        fixed : importPath.search(FIXED_PATH) != -1,
        references : []
    };

    file.imports[importPath].references.push({
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
 * This module provides the ability to analyze source code and find all
 * the import and export declarations of various syntax forms.
 * @module cartographer/declarations
 */
Declarations = module.exports

/**
 * This method takes a Vinyl file and finds all the declarations of imports
 * and exports within the source
 * @param  {Vinyl} file A vinyl file to analyze
 * @return {DeclaredVinyl} The given vinyl file with declared imports and exports
 *                         annotated on it. Only basic normalization is done on
 *                         paths so aliased names will not be combined
 */
Declarations.analyze = function(file) {
    if(!File.isVinyl(file) || file.isNull()) {
        return null;
    }

    // get a string representation of the file to parse
    let source = file.contents.toString();

    // initialize imports/exports of file
    file.imports = {};
    file.exports = {};

    // variables used to collect the requirement information within the module
    let handler = {
        CallExpression : commonJsImport.bind(null, file, source)
    };

    // parse the file as a module, scripts are not currently supported
    let parserOptions = {
        range : true
    };
    esprima.parseModule(source, parserOptions, nodeDispatch.bind(null, handler));

    // convert import from key'd object to array
    let imports = [];
    for(let val in file.imports) {
        imports.push(file.imports[val]);
    }
    file.imports = imports;

    return file;
}
