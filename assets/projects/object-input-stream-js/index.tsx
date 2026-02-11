import {ObjectInputStreamAST, ast as astT} from 'object-input-stream'

import $ from 'jquery';
/// @ts-expect-error
window.$ = $;
import 'jstree';

import astToJstreeNodes from './ast-to-jstree';

const { useState, useEffect, useRef, forwardRef } = window.React;

export default function App() {
    const [file, setFile] = useState<File | null>(null);
    const [content, setContent] = useState<Uint8Array>(new Uint8Array([]));
    const [hexContent, setHexContent] = useState<string>("");
    const [error, setError] = useState("");

    const treeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {(async () => {
        if (file) {
            const newContent = await file.bytes();
            setContent(newContent);
            setHexContent(uint8ArrayToHex(newContent));
        }
    })()}, [file])

    useEffect(() => {
        setError("");

        if (!hexContent.match(/^[0-9a-fA-F]*$/)) {
            setError("Invalid hex");
            return;
        }
        if (hexContent.length % 2 === 1) {
            return;
        }

        setContent(hexToUint8Array(hexContent));
    }, [hexContent])

    useEffect(() => {
        if (content.length === 0) {
            return;
        }

        let ast;
        try {
            const ois = new ObjectInputStreamAST(content);
            ois.readEverything();
            ast = ois.getAST();
        } catch (e) {
            console.error(e);
            setError(""+e);
            return;
        }

        const nodes = astToJstreeNodes(ast);

        const tree = $(treeRef.current!).jstree(true);
        tree.settings!.core.data = nodes;
        tree.refresh();
    }, [content])

    return <>
        <textarea
            placeholder="Enter hex here..."
            style={{width: "100%", backgroundColor: "white", color: "black"}}
            value={hexContent}
            onChange={e => setHexContent(e.target.value)}
            rows={7}
        ></textarea>
        <p className="p">
            <label htmlFor="serialized-file" className="input-file" tabIndex={0}>
                {file?.name ?? <>Upload serialized file</>}
                <input
                    type="file" id="serialized-file" name="serialized-file"
                    onChange={e => setFile(e.target.files?.item(0) ?? null)}
                />
            </label>
        </p>

        <p className="p" style={{color: "red"}}>{error}</p>

        <JsTree ref={treeRef} darkmode={window.useDarkMode().dark} />
    </>
}

declare global {
  interface Window {
    useDarkMode: () => {dark: boolean}
  }
}


const JsTree = forwardRef<HTMLDivElement, {darkmode?: boolean}>(({darkmode=true}, ref) => {
    useEffect(() => {
        if (!ref || typeof ref === "function" || ref.current === null)
            return;

        const tree = $(ref.current).jstree({plugins: ["wholerow"]});

        return () => tree.destroy();
    }, [])

    useEffect(() => {
        if (!ref || typeof ref === "function" || ref.current === null)
            return;

        const tree = $(ref.current).jstree(true);
        tree.set_theme("default" + (darkmode ? "-dark" : ""));
        tree.redraw();
    }, [darkmode])

    return <div ref={ref}></div>
})

function uint8ArrayToHex(arr: Uint8Array): string {
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex: string): Uint8Array {
    if (hex === "") return new Uint8Array();
    return new Uint8Array(hex.match(/..?/g)!.map(byte => parseInt(byte, 16)));
}
