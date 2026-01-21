import * as otp from '@o11k/export-freeotp-backup'

const { useState, useRef } = window.React;

export default function App() {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [uris, setUris] = useState<string[]>([]);

    const doExport = async () => {
        setError('');
        if (file === null) {
            setUris([]);
            setError("File missing");
            return;
        }

        let data: Uint8Array;
        try {
            data = await file.bytes();
        } catch (e) {
            setUris([]);
            setError("Error reading file");
            console.error(e);
            return;
        }

        let parsed: otp.BackupFile;
        try {
            parsed = otp.parseBackupFile(data);
        } catch (e) {
            setUris([]);
            setError("Backup file corrupted");
            console.error(e);
            return;
        }

        let masterKey: CryptoKey;
        try {
            masterKey = await otp.decryptMasterKey(parsed.masterKey, password);
        } catch (e) {
            setUris([]);
            setError("Wrong password");
            console.error(e);
            return;
        }

        const localUris: string[] = [];
        const failed: string[] = [];
        for (const {key, token} of parsed.tokens) {
            let secret: string;
            try {
                secret = await otp.decryptTokenSecret(masterKey, key);
            } catch (e) {
                failed.push(token.label);
                console.error(e);
                continue;
            }
            localUris.push(otp.tokenToUri(token, secret));
        }

        if (failed.length > 0)
            setError("Backup file corrupted: failed to decrypt the following tokens: " + failed.join(", "));

        setUris(localUris);
    }

    return <form onSubmit={e => {e.preventDefault(); doExport()}}>
        <p className="p">
            <label htmlFor="backup-file" className="input-file">
                {file?.name ?? <>Upload <code>externalBackup.xml</code> file</>}
                <input
                    type="file" id="backup-file" name="backup-file"
                    onChange={e => setFile(e.target.files?.item(0) ?? null)}
                />
            </label>
        </p>
        <p className="p">
            <input
                type="password" name="password" id="password" className="input-text" placeholder="Password"
                value={password} onChange={e => setPassword(e.target.value)}
            />
        </p>
        <p className="p">
            <button className="btn-primary" type="submit">Export</button>
        </p>

        <p className="p" style={{color: "red"}}>{error}</p>

        {uris.length === 0 ? null :
            <textarea
                style={{width: "100%", backgroundColor: "white", color: "black"}}
                value={uris.join("\n")}
                rows={uris.length}
                wrap="off"
                readOnly
            />}
    </form>
}
