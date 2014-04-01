/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/** {ext_name} Extension 
    description 
*/
define(function (require, exports, module) {
    'use strict';
    
    var CommandManager = brackets.getModule("command/CommandManager");
    var Menus          = brackets.getModule("command/Menus");
    var KeyBindingManager   = brackets.getModule("command/KeyBindingManager");
    
    var Acorn_loose     = require("thirdparty/acorn/acorn_loose");
    var Walker          = require("thirdparty/acorn/util/walk");
    
    var EditorManager   = brackets.getModule("editor/EditorManager");
    
    var COMMAND_ID  = "annotate.annotateFromParser";
    var MENU_NAME   = "Annotate";
    var EMPTY_MSG   = "No function definition found";
    
    /**
     * Create a jsdoc annotation of the next function found (using a js parser) an insert it one line above 
     */ 
    function annotate() {
        var editor          = EditorManager.getCurrentFullEditor();
        
        //Get cursor position and set it to the beginning of the line
        var pos             = editor.getCursorPos();
        pos.ch = 0;
        
        // Get the text from the start of the document to the current cursor position and count it's length'
        var txtTo = editor._codeMirror.getRange({line:0,ch:0},pos);
        var cursorPosition = txtTo.length;
        
        // Get document text
        var txtFull = editor._codeMirror.getValue();
        
        // Parse text
        var acornTxtFull = Acorn_loose.parse_dammit(txtFull, {locations: true});
        
        // Find next function
        var found = new Walker.findNodeAfter(acornTxtFull, cursorPosition, "Function");
        
        if(found){
            // There was a result, so build jsdoc
            var jsdoc = {};
            jsdoc.loc = found.node.loc;
            jsdoc.prefix = "";
            jsdoc.name = found.node.id ? found.node.id.name : null;
            jsdoc.params = [];
            jsdoc.returnValue = undefined;
            
            //FIXME This is a mess.
            if(!found.node.id) {
                
                var nameHolder = new Walker.findNodeAround(acornTxtFull, found.node.start-1);
                var id, i, l;
                if (nameHolder.node.type === "ObjectExpression"){
                    // set a random id, so it can be found a
                    id = Math.random();
                    found.node.id = id;
                    
                    // Find its neighbour and get the name from that
                    i = 0;
                    l = nameHolder.node.properties.length;
                    for (i = 0; i < l; i++) {
                        var prop = nameHolder.node.properties[i];
                        jsdoc.name = prop.key.name;
                        if(prop.value.id===found.node.id) break;
                    }
                } else if (nameHolder.node.type === "VariableDeclaration") {
                    // set a random id, so it can be found a
                    id = Math.random();
                    found.node.id = id;
                    
                    // Find its neighbour and get the name from that
                    i = 0;
                    l = nameHolder.node.declarations.length;
                    for (i = 0; i < l; i++) {
                        var dec = nameHolder.node.declarations[i];
                        jsdoc.name = dec.id.name;
                        if(dec.init.id===found.node.id) break;
                    }
                } else {
                    nameHolder = new Walker.findNodeBefore(acornTxtFull, found.node.start);
                    jsdoc.name = nameHolder.node.property.name;
                }
            }
            
            // Add parameters to the jsdoc object
            found.node.params.forEach(function (param) {
                jsdoc.params.push(param.name);
            });
            
            // Find and add return value
            var foundReturnValue = new Walker.findNodeAfter(found.node, 0, "ReturnStatement");
            jsdoc.returnValue = foundReturnValue.node ? foundReturnValue.node.argument.name : undefined;
            
            // set prefix (find first none whitespace character)
            var codeLine = editor._codeMirror.getLine(jsdoc.loc.start.line-1);
            jsdoc.prefix = codeLine.substr(0, codeLine.length - codeLine.trimLeft().length).replace(/[^\s\n]/g, ' ');
            
            // build annotation string
            var jsdocString = generateString(jsdoc);
            
            // insertJsdoc string into editor
            insertJsdoc(jsdocString, jsdoc.loc);
        } else {
            // No function definition found
            window.alert(EMPTY_MSG);
        }
    }
    
    /**
     * Create the string representation of the jsdoc object 
     * @param {object} jsdoc input 
     * @returns {string} representation of the jsdoc object 
     */ 
    function generateString(jsdoc){
        var jsdocString  = jsdoc.prefix + "/**\n";
        
        if (jsdoc.name.charAt(0) === "_") {
            jsdocString += jsdoc.prefix + " * @private \n";
        }
        
        // Add description
        jsdocString += jsdoc.prefix + " * Description \n";
        
        jsdoc.params.forEach(function (param) {
            jsdocString += jsdoc.prefix + " * @param {type} " + param + " Description \n";
        });
        if (jsdoc.returnValue)
            jsdocString += jsdoc.prefix + " * @returns {type} Description \n";

        jsdocString += jsdoc.prefix + " */ \n";
        
        return jsdocString;   
    }

    /**
     * Description 
     * @param {string} jsdocString 
     * @param {object} loc location of the function 
     */ 
    function insertJsdoc(jsdocString, loc) {
        // Get editor instance
        var editor  = EditorManager.getCurrentFullEditor();
        var pos = {
            line: loc.start.line-1,
            ch: 0
        };
        
        // Place jsdocString in the editor
        editor._codeMirror.replaceRange(jsdocString, pos);

        EditorManager.focusEditor();
    }
    
    CommandManager.register(MENU_NAME, COMMAND_ID, annotate);
    KeyBindingManager.addBinding(COMMAND_ID, "Ctrl-Alt-A");

    var menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
    menu.addMenuDivider();
    menu.addMenuItem(COMMAND_ID);//"menu-edit-annotate", 
});