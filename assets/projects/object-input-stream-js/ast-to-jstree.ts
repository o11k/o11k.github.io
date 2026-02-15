import {ObjectInputStreamAST as OIS, ast as astT} from 'object-input-stream';

export interface JsTreeNode {
    id?: string,
    text: string,
    icon?: string,
    state?: {
        opened?: boolean,
        disabled?: boolean,
        selected?: boolean,
    },
    children?: JsTreeNode[],
    li_attr?: {[key: string]: string},
    a_attr?: {[key: string]: string},
}

type ResolveHandleFunction = (handle: astT.Handle) => astT.ObjectNode | null;

export default function astToJstreeNodes(ast: astT.Ast): JsTreeNode[] {
    const resolveHandle = getResolveHandleFunction(ast);
    const result = astNodeToJstreeNode(ast.root, resolveHandle);
    const final = Array.isArray(result) ? result : [result];

    if (final.length === 3) {
        final[2].state = {opened: true};
    }

    return final;
}

function astNodeToJstreeNode(node: astT.Node, resolveHandle: ResolveHandleFunction, label: string | null = null): JsTreeNode | JsTreeNode[] {
    // Replace root, blockdata-sequence and reset with their children
    if (
          node.type === "root"
       || node.type === "blockdata-sequence"
       || (node.type === "object" && node.objectType === "reset")
    ) {
        return node.children.flatMap(c => astNodeToJstreeNode(c, resolveHandle));
    }

    const text = getNodeMainText(node, resolveHandle);
    const result: JsTreeNode = {text: (label === null ? "" : label + ": ") + text};

    result.icon = node.children === null ? "jstree-file" : "jstree-folder";

    if (node.children !== null) {
        // TODO special handling for labels
        result.children = node.children.flatMap(c => astNodeToJstreeNode(c, resolveHandle));
    }

    if (node.type === "object" && node.objectType === "prev-object") {
        // TODO send to original
    }

    return result;
}

function getNodeMainText(node: astT.Node, resolveHandle: ResolveHandleFunction): string {
    let a: "class-desc-info" | "proxy-class-desc-info" | "class-data";
    switch (node.type) {
        case "root":
        case "blockdata-sequence":
            throw new Error("Shouldn't be called with " + node.type);

        case "magic":         return "STREAM_MAGIC";
        case "version":       return "STREAM_VERSION";
        case "serial-data":   return "classdata[]";
        case "class-data":    return "classdata";
        case "external-data": return "classdata";

        case "class-desc-info":       return "classDescInfo";
        case "proxy-class-desc-info": return "proxyClassDescInfo"

        case "contents":
        case "blockdata":
        case "annotation":
        case "fields":
        case "values":
            return node.type;

        case "utf":
        case "long-utf":
        case "utf-body":
            return node.type + " " + JSON.stringify(node.value);

        case "tc":
            switch (node.value) {
                case OIS.TC_NULL:           return "TC_NULL";
                case OIS.TC_REFERENCE:      return "TC_REFERENCE";
                case OIS.TC_CLASSDESC:      return "TC_CLASSDESC";
                case OIS.TC_OBJECT:         return "TC_OBJECT";
                case OIS.TC_STRING:         return "TC_STRING";
                case OIS.TC_ARRAY:          return "TC_ARRAY";
                case OIS.TC_CLASS:          return "TC_CLASS";
                case OIS.TC_BLOCKDATA:      return "TC_BLOCKDATA";
                case OIS.TC_ENDBLOCKDATA:   return "TC_ENDBLOCKDATA";
                case OIS.TC_RESET:          return "TC_RESET";
                case OIS.TC_BLOCKDATALONG:  return "TC_BLOCKDATALONG";
                case OIS.TC_EXCEPTION:      return "TC_EXCEPTION";
                case OIS.TC_LONGSTRING:     return "TC_LONGSTRING";
                case OIS.TC_PROXYCLASSDESC: return "TC_PROXYCLASSDESC";
                case OIS.TC_ENUM:           return "TC_ENUM";
                default:
                    const _guard: never = node;
            }

        case "field-desc": {
            const typecode = String.fromCodePoint(node.children[0].value);
            const name = node.children[1].value;

            switch (typecode) {
                case "B": return "byte"    + " " + name;
                case "C": return "char"    + " " + name;
                case "D": return "double"  + " " + name;
                case "F": return "float"   + " " + name;
                case "I": return "int"     + " " + name;
                case "J": return "long"    + " " + name;
                case "S": return "short"   + " " + name;
                case "Z": return "boolean" + " " + name;

                case "L": return "Object"  + " " + name;
                case "[": return "Array"   + " " + name;

                default:
                    throw new Error("Invalid field typecode: " + typecode);
            }
        }

        case "primitive":
            return node.dataType + (node.value === null ? "" : ": " + node.value);

        case "object": {
            switch (node.objectType) {
                case "reset":
                    throw new Error("Shouldn't be called with object/reset");

                case "null":
                    return "null";

                case "prev-object":{
                    const referenced = resolveHandle(node.value);
                    if (referenced === null) {
                        const handle = "0x" + node.value.handle.toString(16);
                        return `broken reference (${handle})`;
                    } else {
                        return "refrence to " + getNodeMainText(referenced, resolveHandle);
                    }
                }

                case "exception":
                    return "exception " + getClassName(node, resolveHandle);
            }

            const handle = "0x" + node.handle.handle.toString(16);

            if (node.objectType === "new-string")
                return "string " + JSON.stringify(node.value) + ` (${handle})`;

            let className = getClassName(node, resolveHandle);

            let type: string;

            switch (node.objectType) {
                case "new-object":     type = "object";    break;
                case "new-class":      type = "class";     break;
                case "new-array":      type = "array";     break;
                case "new-enum":       type = "enum";      break;
                case "new-class-desc": type = "classDesc"; break;

                default:
                    const guard: never = node;
                    throw new Error("Invalid object type: " + (node as any).objectType);
            }

            return `${type} ${className} (${handle})`;
        }
    }
}

function getClassName(node: astT.ObjectNode, resolveHandle: ResolveHandleFunction): string {
    switch (node.objectType) {
        case "reset":
        case "null":
        case "new-string":
            throw new Error("Shouldn't be called with " + node.objectType);

        case "prev-object":
            const referenced = resolveHandle(node.value);
            if (referenced === null)
                return "<broken>";
            else
                return getClassName(referenced, resolveHandle);

        case "new-object":
        case "new-class":
        case "new-array":
        case "exception":
        case "new-enum":
            return getClassName(node.children[1], resolveHandle);

        case "new-class-desc":
            switch (node.children[0].value) {
                case OIS.TC_PROXYCLASSDESC:
                    return "proxy";
                case OIS.TC_CLASSDESC:
                    return (node.children[1] as astT.UtfNode).value;
                default:
                    throw new Error("Invalid classdesc tc: " + JSON.stringify(node.children[0]));
            }
    }
}

function getResolveHandleFunction(ast: astT.Ast): ResolveHandleFunction {
    const map = new Map<string, astT.ObjectNode>;
    for (const node of iterAst(ast.root)) {
        if (node.type === "object" && "handle" in node) {
            map.set(node.handle.epoch + "," + node.handle.handle, node);
        }
    }

    return (handle: astT.Handle) => map.get(handle.epoch + "," + handle.handle) ?? null;
}

function* iterAst(node: astT.Node): Generator<astT.Node> {
    yield node;

    if (node.children !== null) {
        for (const child of node.children) {
            yield* iterAst(child);
        }
    }
}