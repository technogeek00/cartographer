/**
 * This module provides the ability to walk a SpiderMonkey parser AST
 * and inspect any subset of nodes necessary based on their type
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API
 * @module cartographer/ast-walker
 */
var ASTWalker = module.exports

/**
 * Walks the given AST in breath first order supplying nodes to the
 * dispatcher for all types that it can handle
 * @param  {SpiderMonkeyAST} ast An AST in SpiderMonky Parser format
 * @param  {Object} dispatch An object whose keys are the types of AST nodes
 *                           mapped to functions that take a single argument
 *                           which is the node of that type
 * @note Enum types of the Parser spec are not explicitly walked, ex:
 *  - UnaryOperator
 *  - BinaryOperator
 *  - LogicalOperator
 *  - AssignmentOperator
 *  - UpdateOperator
 */
ASTWalker.walk = function(ast, dispatch) {
    dispatch = dispatch || {};
    var nodes = [ast];
    var node = null;

    while(nodes.length > 0) {
        node = nodes.shift();

        // skip if this is not actually a node
        if(!node) {
            continue;
        }

        // if the dispatcher has declared this type, allow it to handle the node
        if(dispatch[node.type]) {
            dispatch[node.type](node);
        }

        switch(node.type) {
            case "Program":
                nodes = nodes.concat(node.body);
                break;

            case "Function":
                nodes = nodes.concat(node.params, node.defaults, node.rest, node.body);
                break;

            case "BlockStatement":
                nodes = nodes.concat(node.body);
                break;

            case "ExpressionStatement":
                nodes.push(node.expression);
                break;

            case "IfStatement":
                nodes.push(node.test, node.consequent, node.alternate);
                break;

            case "LabeledStatement":
                nodes.push(node.label, node.body);
                break;

            case "BreakStatement":
            case "ContinueStatement":
                nodes.push(node.label);
                break;

            case "WithStatement":
                nodes.push(node.object, node.body);
                break;

            case "SwitchStatement":
                nodes = nodes.concat(node.discriminant, nodes.cases);
                break;

            case "ReturnStatement":
                nodes.push(node.argument);
                break;

            case "TryStatement":
                nodes = nodes.concat(nodes.block, node.handler, node.guardedHandlers, node.finalizer);
                break;

            case "WhileStatement":
                nodes.push(node.test, node.body);
                break;

            case "DoWhileStatement":
                nodes.push(node.body, node.test);
                break;

            case "ForStatement":
                nodes.push(node.init, node.test, node.update, node.body);
                break;

            case "ForInStatement":
            case "ForOfStatement":
                nodes.push(node.left, node.right, node.body);
                break;

            case "LetStatement":
                nodes = nodes.concat(node.head, node.body);
                break;

            case "FunctionDeclaration":
                nodes = nodes.concat(node.id, node.params, node.defaults, node.rest, node.body);
                break;

            case "VariableDeclaration":
                nodes = nodes.concat(node.declarations);
                break;

            case "VariableDeclarator":
                nodes.push(node.id, node.init);
                break;

            case "ArrayExpression":
                nodes = nodes.concat(node.elements);
                break;

            case "ObjectExpression":
                nodes = nodes.concat(node.properties);
                break;

            case "Property":
                nodes.push(node.key, node.value);
                break;

            case "FunctionExpression":
                nodes = nodes.concat(node.id, node.params, node.defaults, node.rest, node.body);
                break;

            case "ArrowExpression":
                nodes = nodes.concat(node.params, node.defaults, node.rest, node.body);
                break;

            case "SequenceExpression":
                nodes = nodes.concat(node.expressions);
                break;

            case "UnaryExpression":
                nodes.push(node.argument);
                break;

            case "BinaryExpression":
                nodes.push(node.left, node.right);
                break;

            case "AssignmentExpression":
                nodes.push(node.left, node.right);
                break;

            case "UpdateExpression":
                nodes.push(node.argument);
                break;

            case "LogicalExpression":
                nodes.push(node.left, node.right);
                break;

            case "ConditionalExpression":
                nodes.push(node.test, node.alternate, node.consequent);
                break;

            case "NewExpression":
            case "CallExpression":
                nodes = nodes.concat(node.callee, node.arguments);
                break;

            case "MemberExpression":
                nodes.push(node.object, node.property);
                break;

            case "YieldExpression":
                nodes.push(node.argument);
                break;

            case "ComprehensionExpression":
            case "GeneratorExpression":
                nodes = nodes.concat(node.body, node.blocks, node.filter);
                break;

            case "GraphExpression":
                nodes.push(node.expression);
                break;

            case "LetExpression":
                nodes = nodes.concat(node.head, node.body);
                break;

            case "ObjectPattern":
                var prop = null;
                for(var i = 0; i < node.properties.length; i++) {
                    prop = node.properties[i];
                    nodes.push(prop.key, prop.value);
                }
                break;

            case "ArrayPattern":
                nodes = nodes.concat(node.elements);
                break;

            case "SwitchCase":
                nodes = nodes.concat(node.test, node.consequent);
                break;

            case "CatchClause":
                nodes.push(node.param, node.guard, node.body);
                break;

            case "ComprehensionBlock":
                nodes.push(node.left, node.right);
                break;

            case "ComprehensionIf":
                nodes.push(node.test);
                break;

            case "EmptyStatement":
            case "DebuggerStatement":
            case "ThisExpression":
            case "GraphIndexExpression":
            case "Identifier":
            case "Literal":
                // handle nodes with nothing in them by doing nothing
                break;
        }
    }
}
