let scopedMetadataKey;
let sdkCore;
let sdkSymbol;
let NODE;
let epochAdjustment;
let facade;
let PublicAccount;
let txHash;

// 非表示リスト
const badThreadList = ['88A695491C7BDFCAF9857E02FB82A91C392C927F837B3259877E667BE21BEB96',
    '56F9E9FE0AC6771CC3CBB0438EE5CEB15141920D976022E61C69E5ECD3570C90',
    'A451B1FF7F58512D051CAE7BB52898A270C39EF48FEA975EA76F38C71BEF733C',
    'E696B45806D60AC4875495F70C5312A6EB48402BAFCF83228BA833F78B67B990',
    'FC67E7A5533D9EB72A9DB38A2CB00187F7A00D6A749BDA62BF4AFDA70065D3FE'];

document.getElementById('loading-spinner').style.display = 'block';

async function getAvailableNode() {
    const fixedNode = 'https://symbol-mikun.net:3001'; // 固定ノード
    const NodesUrl = 'https://mainnet.dusanjp.com:3004/nodes?filter=suggested&limit=1000&ssl=true';

    // 🔹 まずノードリストから探す
    try {
        const response = await fetch(NodesUrl);
        const data = await response.json();

        if (data && data.length > 0) {
            // 🔹 `hostDetail.country === "Japan"` のノードをフィルタリング 🇯🇵
            let availableNodes = data.filter(node => node.hostDetail?.country === "Japan");

            if (availableNodes.length === 0) {
                console.warn("⚠️ 日本のノードが見つからなかったため、全ノードから選択します");
                availableNodes = data; // 日本のノードがなければ全ノードを使用
            }

            // 🔹 ブロック高が高い順にソート（`chainHeight` が一番大きいノードを優先）
            availableNodes.sort((a, b) => b.apiStatus.chainHeight - a.apiStatus.chainHeight);

            // 🔹 最もブロック高が高いノードを選択
            const selectedNode = availableNodes[0].apiStatus.restGatewayUrl;
            console.log("🟢 最新ブロック高のノードを使用:", selectedNode, "（ブロック高:", availableNodes[0].apiStatus.chainHeight, "）");
            return selectedNode;
        } else {
            console.warn("⚠️ バックアップノードが見つからなかった。固定ノードを試します。");
        }
    } catch (error) {
        console.error("❌ ノードリストの取得に失敗:", error);
    }

    // 🔹 最後の手段として固定ノードを試す
    try {
        const response = await fetch(`${fixedNode}/node/health`);
        const healthData = await response.json();
        console.log("healthData========", healthData);

        if (healthData && healthData.status.db && healthData.status.apiNode === 'up') {
            console.log("✅ 固定ノードを使用:", fixedNode);
            return fixedNode;
        }
    } catch (error) {
        console.error("❌ 固定ノードもダウンしているため、利用可能なノードが見つかりません。");
    }

    return null; // どのノードも使えなかった場合
}


async function loadSDK() {

    NODE = await getAvailableNode();
    if (!NODE) {
        console.error("🚨 使用可能なノードが見つかりませんでした。");
        return;
    }

    const SDK_VERSION = "3.3.0";
    const sdk = await import(`https://unpkg.com/symbol-sdk@${SDK_VERSION}/dist/bundle.web.js`);
    sdkCore = sdk.core;
    sdkSymbol = sdk.symbol;

    // NODE = 'https://symbol-mikun.net:3001'; // ノードURL

    // ネットワークプロパティを取得
    const networkProperties = await fetch(
        new URL('/network/properties', NODE),
        {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        }
    ).then((res) => res.json());

    const e = networkProperties.network.epochAdjustment;
    epochAdjustment = Number(e.substring(0, e.length - 1));
    const identifier = networkProperties.network.identifier;
    console.log("identifier=", identifier);

    // facadeを作成
    facade = new sdkSymbol.SymbolFacade(identifier);

    scopedMetadataKey = sdkSymbol.metadataGenerateKey("social_meta_data");  // メタデータキー生成

    displayThreads(); // スレッドを表示

    document.getElementById('thread_address').innerHTML = `<span style="font-size: 13px;"><p style="color:blue;">送信先<br>NB2TFCNBOXNG6FU2JZ7IA3SLYOYZ24BBZAUPAOA</p>トランザクションが承認されるとスレッドが作成され、<br>ブロックチェーン上に永続的に記録されます。</span>`; // スレッドモーダルにアドレス表示

    // fetchPostDates() を実行してからカレンダーを表示
    fetchPostDates().then(() => {
        loadCalendar(currentYear, currentMonth);
    });
}

loadSDK();  // 非同期関数を呼び出す


// URLパラメータからpubkeyを取得
const urlParams = new URLSearchParams(window.location.search);
let pubkey = urlParams.get('pubkey');


// スレッド作成モーダルを開く
document.getElementById('open-modal').addEventListener('click', function () {
    document.getElementById('modal').style.display = 'flex'; // flexで中央配置
});

// メタデータモーダルを開く
document.getElementById('open-metadata-modal').addEventListener('click', function () {
    document.getElementById('metadata-modal').style.display = 'flex'; // flexで中央配置
});

// モーダルを閉じる処理
document.querySelectorAll('.close').forEach(closeButton => {
    closeButton.addEventListener('click', function () {
        // メタデータモーダルも対象にする
        const parentModal = closeButton.closest('.modal, .social-metadata-modal');
        if (parentModal) {
            parentModal.style.display = 'none';
        }
    });
});

// モーダル外をクリックした場合も閉じる
window.addEventListener('click', function (event) {
    const modals = document.querySelectorAll('.modal, .social-metadata-modal');
    modals.forEach(modal => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
});

// 作成ボタンを押すとaLiceでトランザクションを送信
document.getElementById('create-thread-button').addEventListener('click', createThread);


// マウスオーバーでアイコンの右にアドレスを表示する

// 動的に生成された要素に対してイベントリスナーを追加する
function addHoverEffect() {

    if (window.innerWidth >= 768) {
        // デスクトップ環境
        document.querySelectorAll('.avatar-container_2').forEach(container => {
            const tooltip = container.querySelector('.address-tooltip');

            // マウスオーバーでアドレスを表示
            container.addEventListener('mouseenter', () => {
                tooltip.style.display = 'block';
            });

            // マウスが離れたらアドレスを非表示
            container.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });

    } else {
        // モバイル環境
        document.querySelectorAll('.avatar-container_2').forEach(container => {
            let tapped = false;
            const tooltip = container.querySelector('.address-tooltip');

            // タップでアドレスを表示
            container.addEventListener('click', function (e) {
                e.preventDefault(); // デフォルトのリンク動作を無効化
                if (!tapped) {
                    // 最初のタップでアドレス表示
                    tooltip.style.display = 'block';
                    tapped = true;
                } else {
                    // 2回目のタップでリンク先へ移動
                    window.location.href = this.querySelector('a').href;
                    tapped = false;
                }
            });

            // 別の場所をタップしたときにアドレスを非表示にする
            document.addEventListener('click', function (event) {
                if (!container.contains(event.target)) {
                    tooltip.style.display = 'none';
                    tapped = false;
                }
            });
        });
    }

}

// ハンバーガーメニューのリンクをクリックした際にモーダルを開く
document.getElementById('open-metadata-modal').addEventListener('click', async () => {
    document.getElementById('metadata-modal').style.display = 'flex';

    let accountAddress;
    if (pubkey) {
        PublicAccount = facade.createPublicAccount(new sdkCore.PublicKey(pubkey));  // アカウントのアドレス
        accountAddress = PublicAccount.address;
    } else {
        if (window.SSS && window.SSS.activePublicKey) {
            PublicAccount = facade.createPublicAccount(new sdkCore.PublicKey(window.SSS.activePublicKey));
            accountAddress = PublicAccount.address;
        }
        if (window.innerWidth <= 768) {
            // モバイル環境の場合、aLiceで公開鍵を取得する
            const arrayBuffer = new TextEncoder().encode('https://xym-thread.com/index.html');
            const callback = Array.from(new Uint8Array(arrayBuffer), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
            const encodedUrl = `alice://sign?type=request_pubkey&callback=${callback}`;
            window.location.href = encodedUrl;
        }
    }

    // メタデータを取得してフォームに反映
    async function fetchAndApplyMetadata(accountAddress, scopedMetadataKey) {
        try {
            // メタデータを取得するためのクエリパラメータを設定
            const params = new URLSearchParams({
                targetAddress: accountAddress.toString(),  // アカウントアドレス
                scopedMetadataKey: scopedMetadataKey.toString(16).toUpperCase(),  // メタデータキー
                metadataType: 0,  // 0 = アカウントメタデータ
                "pageSize": 100, // 1ページあたりの最大取得数
            });

            // メタデータ取得エンドポイントを呼び出し
            const response = await fetch(new URL(`/metadata?${params.toString()}`, NODE), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            const metadataEntries = await response.json();
            const metadataArray = metadataEntries.data;

            if (metadataArray.length > 0) {

                metadataArray.forEach(entry => {
                    if (entry.metadataEntry.scopedMetadataKey === scopedMetadataKey.toString(16).toUpperCase()) {
                        const rawValue = entry.metadataEntry.value;

                        try {
                            // メタデータの値をデコードし、JSONパース

                            // 16進数文字列からバイト配列に変換
                            const byteArray = hexToBytes(rawValue);

                            // バイト配列をデコード
                            const decodedValue = new TextDecoder().decode(byteArray);

                            const cleanedValue = decodedValue.replace(/\\\"/g, '"');  // バックスラッシュ解除
                            const parsedData = JSON.parse(cleanedValue);

                            // フォームにデータを反映
                            document.getElementById('imageUrl').value = parsedData.imageUrl || '';
                            document.getElementById('url').value = parsedData.url || '';
                            document.getElementById('namespace').value = parsedData.namespace || '';
                            document.getElementById('name').value = parsedData.name || '';

                            // アバター画像をプレビュー表示
                            if (parsedData.imageUrl) {
                                document.getElementById('avatar-preview').src = parsedData.imageUrl;
                                document.getElementById('avatar-preview').style.display = 'block';
                            }
                        } catch (err) {
                            console.error('JSONパースエラー:', err);
                        }
                    } else {
                        console.log("指定されたスコープメタデータキーのメタデータが見つかりませんでした。");
                    }
                })
            } else {
                console.log("メタデータが存在しません。");
            }
        } catch (error) {
            console.error("メタデータの取得に失敗しました:", error);
        }
    }

    // メタデータ取得を実行
    fetchAndApplyMetadata(accountAddress, scopedMetadataKey);

});

// メタデータ更新ボタンの処理
document.getElementById('submit-metadata').addEventListener('click', async () => {
    const imageUrl = document.getElementById('imageUrl').value;
    const url = document.getElementById('url').value;
    const namespace = document.getElementById('namespace').value;
    const name = document.getElementById('name').value;

    const metadataValue = JSON.stringify({ imageUrl, url, namespace, name });

    // キーと値の設定
    const key = scopedMetadataKey;
    const value = new TextEncoder().encode(metadataValue);

    // アカウントアドレスの取得
    let accountAddress;
    if (window.SSS && window.SSS.activePublicKey) {
        PublicAccount = facade.createPublicAccount(new sdkCore.PublicKey(window.SSS.activePublicKey));  // アカウントのアドレス
        accountAddress = PublicAccount.address;
        pubkey = window.SSS.activePublicKey;
    } else if (window.innerWidth <= 768) {
        // モバイル環境の場合、aLiceで公開鍵を取得してから処理を行う
        //      const publicKeyFromAlice = await getPublicKeyFromCallback(); // コールバックURLから公開鍵を取得する関数
        PublicAccount = facade.createPublicAccount(new sdkCore.PublicKey(pubkey));  // アカウントのアドレス
        accountAddress = PublicAccount.address;
    }

    // メタデータトランザクションのセット (V3対応)
    let tx, aggregateTx;
    try {
        // ターゲットと作成者アドレスの設定
        const targetAddress = accountAddress;  // メタデータ記録先アドレス
        const sourceAddress = accountAddress;  // メタデータ作成者アドレス

        // 同じキーのメタデータが登録されているか確認
        const query = new URLSearchParams({
            "targetAddress": targetAddress.toString(),
            "sourceAddress": sourceAddress.toString(),
            "scopedMetadataKey": key.toString(16).toUpperCase(),
            "metadataType": 0
        });
        const metadataInfo = await fetch(
            new URL(`/metadata?${query.toString()}`, NODE),
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }
        ).then(res => res.json()).then(json => json.data);

        // 登録済の場合は差分データを作成する
        let sizeDelta = value.length;
        let updatedValue = value;
        if (metadataInfo.length > 0) {
            sizeDelta -= metadataInfo[0].metadataEntry.valueSize;
            updatedValue = sdkSymbol.metadataUpdateValue(
                sdkCore.utils.hexToUint8(metadataInfo[0].metadataEntry.value),
                value
            );
        }

        // アカウントメタデータ登録Tx作成
        const descriptor = new sdkSymbol.descriptors.AccountMetadataTransactionV1Descriptor(
            targetAddress,  // ターゲットアドレス
            key,            // キー
            sizeDelta,      // サイズ差分
            updatedValue    // 値
        );

        // 埋め込みトランザクション作成
        tx = facade.createEmbeddedTransactionFromTypedDescriptor(
            descriptor,       // トランザクション Descriptor 設定
            pubkey            // 署名者公開鍵
        );

        const embeddedTransactions = [tx];

        // アグリゲートTx作成
        const aggregateDescriptor = new sdkSymbol.descriptors.AggregateCompleteTransactionV2Descriptor(
            facade.constructor.hashEmbeddedTransactions(embeddedTransactions),
            embeddedTransactions
        );

        aggregateTx = facade.createTransactionFromTypedDescriptor(
            aggregateDescriptor,  // トランザクション Descriptor 設定
            pubkey,               // 署名者公開鍵
            100,                  // 手数料乗数
            60 * 60 * 2,          // Deadline:有効期限(秒単位)
            0                     // 連署者数
        );

        console.log("aggregateTx=", aggregateTx);

    } catch (error) {
        console.error("トランザクションのセットに失敗しました:", error);
    }


    // ウィンドウ幅でaLice / SSSを切り替える
    if (window.innerWidth <= 768) {
        // モバイル環境の場合はaLiceを使用
        const transactionPayload = sdkCore.utils.uint8ToHex(aggregateTx.serialize());  // V3
        const aliceUrl = `alice://sign?data=${transactionPayload}&type=request_sign_transaction&node=${utf8ToHex(NODE)}&method=announce`;
        window.location.href = aliceUrl;
    } else {
        // デスクトップ環境の場合はSSSを使用
        const payload = sdkCore.utils.uint8ToHex(aggregateTx.serialize());
        window.SSS.setTransactionByPayload(payload);
        window.SSS.requestSign().then(signedPayload => {   // SSSを用いた署名をユーザーに要求
            console.log('signedPayload', signedPayload);
            jsonPayload = `{"payload": "${signedPayload.payload}"}`
            // SSSで署名されたトランザクションの送信
            fetch(`${NODE}/transactions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: jsonPayload
            })
                .then(response => {
                    if (response.ok) {
                        console.log('トランザクションが送信されました！');
                        Swal.fire({
                            title: 'Success!',
                            text: 'アナウンスが送信されました！',
                            icon: 'success',
                            confirmButtonText: 'OK'
                        });
                    } else {
                        console.error('トランザクションの送信に失敗しました:', response);
                    }
                })
                .catch(error => {
                    console.error('エラー:', error);
                });
        }).catch((error) => {
            console.error('署名のエラー:', error);
        })
    }
});

// キャンセルボタンを押したときにソーシャルメタデータモーダルを閉じる
document.getElementById('cancel-metadata').addEventListener('click', function () {
    document.getElementById('metadata-modal').style.display = 'none';
});


// モバイル環境で公開鍵を取得するためのコールバック処理
function getPublicKeyFromCallback() {
    // コールバックURLで公開鍵を受け取る処理
    const urlParams = new URLSearchParams(window.location.search);
    const publicKey = urlParams.get('publicKey');
    return publicKey;
}


function createThread() {

    const message = document.getElementById('thread-message').value;
    const amount = document.getElementById('xym-amount').value;

    if (!message || amount < 0.000001) {
        Swal.fire('メッセージと送金するXYMを確認してください');
        return;
    }

    if (byteLengthUTF8(message) > 1023) {
        Swal.fire(`メッセージのサイズが${bytelength(message)}バイトです!!          
                   1023バイト 以下にしてください。`);
        return;
    }

    // スレッドメッセージをSymbolのトランザクションとして送信
    sendThreadTransaction(message, amount);
}

// スレッドメッセージとXYMをSymbolブロックチェーンに送信する
function sendThreadTransaction(message, amount) {

    const recipientAddress = new sdkSymbol.Address("NB2TFCNBOXNG6FU2JZ7IA3SLYOYZ24BBZAUPAOA");
    const plainMessage = new Uint8Array([0x00, ...new TextEncoder().encode(message)]);

    // トランザクション Descriptor 設定
    descriptor = new sdkSymbol.descriptors.TransferTransactionV1Descriptor(  // Txタイプ:転送Tx
        recipientAddress,      // 受取アドレス
        [
            //// XYM送金
            new sdkSymbol.descriptors.UnresolvedMosaicDescriptor(
                new sdkSymbol.models.UnresolvedMosaicId(0x6BED913FA20223F8n),
                new sdkSymbol.models.Amount(BigInt(amount * Math.pow(10, 6)))
            )
        ],
        plainMessage       // メッセージ
    );

    if (window.innerWidth >= 768) {   // モバイルではない場合、SSSから公開鍵を取得
        if (window.SSS.activePublicKey) {
            pubkey = window.SSS.activePublicKey;
        } else {
            Swal.fire({
                title: 'Error!!',
                text: 'SSSとリンクしていません！',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    } else {  // モバイルの場合
        pubkey = new sdkCore.PublicKey('0000000000000000000000000000000000000000000000000000000000000000'); // 公開鍵は aLice で設定する
    }

    tx = facade.createTransactionFromTypedDescriptor(
        descriptor,       // トランザクション Descriptor 設定
        pubkey,  // 署名者公開鍵
        100,              // 手数料乗数
        60 * 60 * 2       // Deadline:有効期限(秒単位)
    );


    if (window.innerWidth <= 768) {  // ウィンドウサイズで aLice / SSS を切り替える。
        const transactionPayload = sdkCore.utils.uint8ToHex(tx.serialize());  // V3
        const aliceUrl = `alice://sign?data=${transactionPayload}&type=request_sign_transaction&node=${utf8ToHex(NODE)}&method=announce`; //&deadline=3600&callback=${callback}`;
        window.location.href = aliceUrl;
    } else {
        const payload = sdkCore.utils.uint8ToHex(tx.serialize());

        window.SSS.setTransactionByPayload(payload);
        window.SSS.requestSign().then(signedPayload => {   // SSSを用いた署名をユーザーに要求
            console.log('signedPayload', signedPayload);

            txHash = signedPayload.transactionHash; // 64文字のフルハッシュ

            jsonPayload = `{"payload": "${signedPayload.payload}"}`
            // SSSで署名されたトランザクションの送信
            fetch(`${NODE}/transactions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: jsonPayload
            })
                .then(response => {
                    if (response.ok) {
                        console.log('トランザクションが送信されました！');
                        Swal.fire({
                            title: 'Success!',
                            text: 'アナウンスが送信されました！',
                            icon: 'success',
                            confirmButtonText: 'OK'
                        });

                        // Vercel にスレッド登録
                        fetch('https://xym-thread-notifications.vercel.app/api/save-thread', {
                            method: 'POST',
                            mode: 'cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                hash: txHash,
                                owner_pubkey: window.SSS.activePublicKey,
                                title: document.getElementById('thread-message').value.trim()
                            })
                        });
                    } else {
                        console.error('トランザクションの送信に失敗しました:', response);
                    }
                })
                .catch(error => {
                    console.error('エラー:', error);
                });
        }).catch((error) => {
            console.error('署名のエラー:', error);
        })
    }
}

// メタデータを取得し、特定のキーが存在する場合にアイコンを設定
function fetchMetadataAndSetIcon(publicKey, threadElement) {

    PublicAccount = facade.createPublicAccount(new sdkCore.PublicKey(publicKey));  // アカウントのアドレス
    accountAddress = PublicAccount.address;

    // メタデータの取得 (V3)
    async function fetchMetadataV3(address, scopedMetadataKey, threadElement, publicKey) {
        try {
            // クエリパラメータの設定
            const params = new URLSearchParams({
                targetAddress: address.toString(),  // アカウントアドレス
                scopedMetadataKey: scopedMetadataKey.toString(16).toUpperCase(),  // スコープメタデータキー
                metadataType: 0,  // アカウントメタデータ (0)
                "pageSize": 100,           // 必要に応じて調整
                order: "desc"            // 降順で取得
            });

            // メタデータエンドポイントに対してGETリクエストを送信
            const response = await fetch(new URL(`/metadata?${params.toString()}`, NODE), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            const metadataEntries = await response.json();
            const metadataArray = metadataEntries.data;

            // メタデータエントリの中から対象のスコープキーを検索
            if (metadataArray.length > 0) {

                metadataArray.forEach(entry => {

                    if (entry.metadataEntry.scopedMetadataKey === scopedMetadataKey.toString(16).toUpperCase()) {
                        // メタデータが存在する場合、JSONデータを解析

                        const rawValue = entry.metadataEntry.value;

                        // 16進数文字列からバイト配列に変換
                        const byteArray = hexToBytes(rawValue);

                        // バイト配列をデコード
                        const decodedValue = new TextDecoder().decode(byteArray);

                        // エスケープ解除とJSONパース
                        // const decodedValue = new TextDecoder().decode(Uint8Array.from(rawValue));
                        const cleanedValue = decodedValue.replace(/\\\"/g, '"');  // バックスラッシュでエスケープされたダブルクォーテーションを解除
                        const metadataJson = JSON.parse(cleanedValue);

                        // アイコン画像とリンクを設定
                        const imageUrl = metadataJson.imageUrl;
                        const url = metadataJson.url;
                        const name = metadataJson.name ? metadataJson.name.trim() : ""; // 名前がない場合は "" 空文字で

                        if (imageUrl && url) {
                            // アバター画像とリンクを設定
                            threadElement.querySelector('.avatar').outerHTML = `
                        <a href="${url}" target="_blank">
                            <img src="${imageUrl}" alt="Avatar" class="avatar" style="cursor:pointer; width:50px; height:50px; border-radius:50%;">
                        </a>
                        <span class="smd-name">${name}</span>
                    `;
                        }
                    } else {
                        // メタデータが存在しない場合、ランダムな画像を設定
                        threadElement.querySelector('.avatar').outerHTML = `
                    <img src="${getRandomImage(publicKey)}" alt="Avatar" class="avatar" style="cursor:pointer; width:50px; height:50px; border-radius:50%;">
                `;
                    }
                })
            } else {
                // メタデータが存在しない場合、ランダムな画像を設定
                threadElement.querySelector('.avatar').outerHTML = `
                <img src="${getRandomImage(publicKey)}" alt="Avatar" class="avatar" style="cursor:pointer; width:50px; height:50px; border-radius:50%;">
            `;

            }

        } catch (err) {
            console.error('メタデータの取得エラー:', err);
        }
    }

    // メタデータ取得を実行
    fetchMetadataV3(accountAddress, scopedMetadataKey, threadElement, publicKey);

}

let currentPage = 1;  // 現在のページ
const pageSize = 10;   // 1ページあたりのスレッド数

function displayThreads() {
    document.getElementById('loading-spinner').style.display = 'block';
    const recipientAddress = new sdkSymbol.Address('NB2TFCNBOXNG6FU2JZ7IA3SLYOYZ24BBZAUPAOA');
    const threadContainer = document.getElementById('thread-list');

    if (currentPage === 1) {
        threadContainer.innerHTML = '';  // 最初のページのみリストをクリア
    }

    async function fetchTransactions() {
        const params = new URLSearchParams({
            "address": recipientAddress.toString(),
            "embedded": true,
            "pageSize": pageSize,
            "pageNumber": currentPage,  // `currentPage` を適用
            "order": "desc"
        });

        const result = await fetch(
            new URL('/transactions/confirmed?' + params.toString(), NODE),
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }
        ).then((res) => res.json())
            .catch(err => {
                console.error('トランザクション取得エラー:', err);
                document.getElementById('loading-spinner').style.display = 'none';
            });

        if (!result || result.data.length === 0) {
            document.getElementById('loading-spinner').style.display = 'none';
            hideLoadMoreButton(); // データがなければボタンを隠す
            return;
        }

        const txes = result.data;

        txes.forEach(tx => {
            if (badThreadList.includes(tx.meta.hash)) return;

            if (tx.transaction.message) {
                appendThread(tx);
            }
        });

        if (txes.length === pageSize) {
            showLoadMoreButton();
        } else {
            hideLoadMoreButton();
        }

        document.getElementById('loading-spinner').style.display = 'none';
    }

    fetchTransactions();
}

function appendThread(tx) {
    const threadContainer = document.getElementById('thread-list');
    const threadHash = tx.meta.hash;
    const threadOwner = tx.transaction.signerPublicKey;
    const threadTimestamp = epochAdjustment + (tx.meta.timestamp / 1000);
    PublicAccount = facade.createPublicAccount(new sdkCore.PublicKey(threadOwner));

    const threadElement = document.createElement('div');
    threadElement.className = 'thread-item';
    threadElement.setAttribute('data-hash', threadHash);

    const date = new Date(threadTimestamp * 1000);
    const ymdhms = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)} ${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;

    const xymAmount = tx.transaction.mosaics[0].amount / Math.pow(10, 6);
    const fontSize = Math.min(10 + xymAmount * 10, 40);
    const linkedMessage = convertURLsToLinks(hexToUtf8(tx.transaction.message));

    threadElement.innerHTML = `
     <div class="thread-header">
     <div class="avatar-container_2" style="position:relative;">
         <div class="avatar"></div>
         <div class="address-tooltip" style="display:none; position:absolute; top:50%; left:-10%; transform:translate(0%, 100%); background-color:#333; color:#fff; padding:5px; border-radius:5px; white-space:nowrap; font-size:12px; z-index:10;">
              ${PublicAccount.address.toString()}
         </div>
     </div>
         <div class="thread-info">
             <div class="thread-date">${ymdhms}</div>
             <div class="thread-amount"><img src="src/fontsize2.png" alt="fontsize" class="fontsize-icon"> ${xymAmount} XYM</div>
         </div>
     </div>
     <div class="border-line"></div>
     <div class="thread-message" style="font-size: ${fontSize}px;">
         ${linkedMessage}
     </div>
     <br>
     <div class="thread-footer">
       <a class="x-share-button_th" data-url="${window.location.origin}/thread.html?id=${tx.meta.hash}">
         <img src="src/x.png" alt="x" class="x-icon_th">
       </a>
       <button class="open-thread-icon-button" data-hash="${tx.meta.hash}">
         <img src="src/thread.png" alt="open" class="open-icon">
       </button>
     </div>
    `;

    threadContainer.appendChild(threadElement);

    fetchMetadataAndSetIcon(tx.transaction.signerPublicKey, threadElement);

    addHoverEffect();  // リスナーを再設定

    // イベントリスナーを一度だけ登録
    document.querySelectorAll('.open-thread-icon-button').forEach(button => {
        button.removeEventListener('click', openThread);
        button.addEventListener('click', openThread);
    });

    document.querySelectorAll('.x-share-button_th').forEach(button => {
        button.removeEventListener('click', handleShareClick);
        button.addEventListener('click', handleShareClick);
    });

    // 日付クリックでSymbolエクスプローラーを開くイベントリスナーを追加
    threadElement.querySelector('.thread-date').addEventListener('click', () => {
        const explorerUrl = `https://symbol.fyi/transactions/${threadHash}`;
        window.open(explorerUrl, '_blank');
    });

    // コメント数の取得
    fetchThreadCommentsV3(threadHash, threadOwner, threadTimestamp);
}

function showLoadMoreButton() {
    let loadMoreButton = document.getElementById('load-more');
    if (!loadMoreButton) {
        loadMoreButton = document.createElement('button');
        loadMoreButton.id = 'load-more';
        loadMoreButton.innerText = 'もっと見る';
        loadMoreButton.onclick = () => {
            //loadMoreButton.style.display = 'none'; // ボタンを一時的に非表示
            loadMoreButton.remove();  // 一度ボタンを削除
            currentPage++;
            displayThreads();
        };
        document.getElementById('thread-list').appendChild(loadMoreButton);
    }
    loadMoreButton.style.display = 'block';
}

function hideLoadMoreButton() {
    const loadMoreButton = document.getElementById('load-more');
    if (loadMoreButton) {
        loadMoreButton.style.display = 'none';
    }
}


function getRandomImage(publicKey) {
    const hash = CryptoJS.SHA256(publicKey).toString();
    const index = parseInt(hash.slice(0, 8), 16) % 16 + 1; // ランダムに1-16の範囲の数値を生成
    return `https://xym-thread.com/avatar/${index}.png`; // ランダムな画像URLを返す
}

function byteLengthUTF8(s) {
    return new TextEncoder().encode(s).length;
}

/*
function convertURLsToLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<br><br><a href="$1" target="_blank">➡️詳細はこちらから</a>');
}
*/

function convertURLsToLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text
        .replace(/\n/g, '<br>') // 改行を <br> に変換
        .replace(urlRegex, '<br><br><a href="$1" target="_blank">➡️詳細はこちらから</a>');
}


async function fetchThreadCommentsV3(threadHash, threadOwner, threadTimestamp) {
    let commentCount = 0;
    let totalXYM = 0;
    let pageNumber = 1;

    PublicAccount = facade.createPublicAccount(new sdkCore.PublicKey(threadOwner));
    const recipientAddress = PublicAccount.address;

    // 次のページのデータを取得する関数
    async function fetchNextPage(pageNumber) {
        const params = new URLSearchParams({
            "address": recipientAddress.toString(),
            "pageSize": 100,
            "pageNumber": pageNumber,
            "order": "desc"
        });

        // トランザクションを取得するエンドポイントへのリクエスト
        const response = await fetch(
            new URL(`/transactions/confirmed?${params.toString()}`, NODE), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const transactions = await response.json();

        if (transactions.data.length === 0) {
            updateCommentCountDisplay(threadHash, commentCount, totalXYM); // コメント数と合計XYMの表示更新
            return;
        }

        let shouldContinue = true; // 処理を続けるかどうかを判断するフラグ
        // let decodedMessage;
        for (const tx of transactions.data) {
            const transactionTimestamp = epochAdjustment + (tx.meta.timestamp / 1000);

            // スレッドのタイムスタンプ以前のトランザクションは処理しない
            if (Number(transactionTimestamp) <= Number(threadTimestamp)) {
                shouldContinue = false; // タイムスタンプに到達したら処理を終了
                break;
            }

            //  console.log("tx=",tx);
            // コメントのカウント処理
            if (tx.transaction.message) {
                const decodedMessage = hexToUtf8(tx.transaction.message);
                if (decodedMessage.substring(2, 7) === threadHash.substring(0, 5)) { // デコードした先頭にヌル文字が入っているので substring(2, 7) としている
                    commentCount++;
                    // 送金されたXYMの量を加算
                    const mosaicAmount = tx.transaction.mosaics[0].amount;
                    const xymAmount = parseInt(mosaicAmount) / Math.pow(10, 6); // XYM量を計算
                    totalXYM += xymAmount;
                }
            }

        }

        // 次のページを取得するかどうかを判断
        if (shouldContinue) {
            pageNumber++;
            await fetchNextPage(pageNumber); // 次のページを取得
        } else {
            updateCommentCountDisplay(threadHash, commentCount, totalXYM); // コメント数と合計XYMを更新
        }
    }

    // 最初のページの取得を開始
    await fetchNextPage(pageNumber);
}

function updateCommentCountDisplay(threadHash, commentCount, totalXYM) {
    const threadElement = document.querySelector(`.thread-item[data-hash="${threadHash}"]`);
    if (threadElement) {
        // .thread-footerを作成して、info-displayとボタンをまとめる
        const threadFooter = threadElement.querySelector('.thread-footer') || document.createElement('div');
        threadFooter.className = 'thread-footer';

        // info-displayのコンテナを作成
        const infoContainer = document.createElement('div');
        infoContainer.className = 'info-display';
        infoContainer.innerHTML = `　　
            <img src="src/xym.png" alt="XYMアイコン" class="xym-icon">
            <span class="total-xym">${totalXYM.toLocaleString()}</span>
            <img src="src/comment.png" alt="コメントアイコン" class="comment-icon">
            <span class="comment-count">${commentCount}</span>
        `;

        // スレッドを開くボタンの作成
        const openThreadButton = document.createElement('button');
        openThreadButton.className = 'open-thread-icon-button';
        openThreadButton.setAttribute('data-hash', threadHash);
        openThreadButton.innerHTML = `<img src="src/thread.png" alt="open" class="open-icon">`;

        // info-displayとスレッドを開くボタンをthread-footerに追加
        if (!threadFooter.querySelector('.info-display')) {
            threadFooter.appendChild(infoContainer);
        }
        if (!threadFooter.querySelector('.open-thread-icon-button')) {
            threadFooter.appendChild(openThreadButton);
        }

        // thread-footerをスレッドの最後に追加
        if (!threadElement.querySelector('.thread-footer')) {
            threadElement.appendChild(threadFooter);
        }
    }
}


function hexToUtf8(hex) {
    // 16進数の文字列をバイト配列に変換
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }

    // バイト配列をUTF-8文字列に変換
    const utf8String = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    return utf8String;
}

function hexToBytes(hex) {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) {
        bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return new Uint8Array(bytes);
}

function utf8ToHex(str) {
    const encoder = new TextEncoder(); // UTF-8エンコーダ
    const bytes = encoder.encode(str); // UTF-8バイト配列に変換
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0')) // 各バイトを16進数に変換
        .join(''); // 配列を文字列に結合
}

function handleShareClick(event) {
    event.preventDefault();
    const pageUrl = event.currentTarget.getAttribute('data-url');
    const message = `#Symbol #XYM_Thread ${pageUrl}`;
    const appUrl = `twitter://post?message=${encodeURIComponent(message)}`;
    const webUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(message)}`;

    // アプリを開く
    window.location.href = appUrl;

    // 一定時間後にアプリが開かない場合、ウェブにフォールバック
    setTimeout(() => {
        window.open(webUrl, '_blank');
    }, 1000); // 1秒後にフォールバック
}

function openThread(event) {
    const transactionHash = event.currentTarget.getAttribute('data-hash');
    window.location.href = `thread.html?id=${transactionHash}`;
}


let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

document.addEventListener("DOMContentLoaded", function () {
    const calendarButton = document.getElementById('calendar-button');
    const calendarModal = document.getElementById('calendar-popup');
    if (calendarButton) {
        calendarButton.addEventListener('click', function () {
            // 表示・非表示を切り替え
            if (calendarModal.style.display === 'block') {
                calendarModal.style.display = 'none';
            } else {
                calendarModal.style.display = 'block';
                loadCalendar(currentYear, currentMonth); // カレンダーをロード
            }
        });
    } else {
        console.error("Error: #calendar-button が見つかりません");
    }

});

document.querySelector('.close-calendar').addEventListener('click', function () {
    document.getElementById('calendar-popup').style.display = 'none';
});



function loadCalendar(year, month) {
    const calendarContainer = document.getElementById('calendar');
    calendarContainer.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    let calendarHtml = `
        <div class="calendar-header">
            <button id="prev-month">«</button>
            <button id="month-year-btn" class="month-year-btn">${year}年${month + 1}月</button>
            <button id="next-month">»</button>
        </div>
        <div class="calendar-grid">
    `;

    const days = ['日', '月', '火', '水', '木', '金', '土'];
    days.forEach(day => {
        calendarHtml += `<div class="calendar-day-name">${day}</div>`;
    });

    for (let i = 0; i < firstDay; i++) {
        calendarHtml += `<div></div>`;
    }

    for (let date = 1; date <= lastDate; date++) {
        let formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        let dayClass = "calendar-day";

        if (postDates.includes(formattedDate)) {
            dayClass += " marked-day";
        }

        calendarHtml += `<div class="${dayClass}" data-date="${formattedDate}">${date}</div>`;
    }

    calendarHtml += '</div>';
    calendarContainer.innerHTML = calendarHtml;

    document.getElementById('prev-month').addEventListener('click', function () {
        if (currentMonth === 0) {
            currentYear--;
            currentMonth = 11;
        } else {
            currentMonth--;
        }
        loadCalendar(currentYear, currentMonth);
    });

    document.getElementById('next-month').addEventListener('click', function () {
        if (currentMonth === 11) {
            currentYear++;
            currentMonth = 0;
        } else {
            currentMonth++;
        }
        loadCalendar(currentYear, currentMonth);
    });

    document.getElementById('month-year-btn').addEventListener('click', openYearMonthPicker);

    document.querySelectorAll('.marked-day').forEach(day => {
        day.addEventListener('click', function () {
            const selectedDate = this.getAttribute('data-date');
            console.log("選択した日付:", selectedDate);
            fetchThreadsByDate(selectedDate);

            document.getElementById('calendar-popup').style.display = 'none';
        });
    });
}

function openYearMonthPicker() {
    let pickerHTML = `
        <div class="picker-overlay">
            <div class="picker-container">
                <div class="picker-header">
                    <span>年月を選択</span>
                </div>
                <div class="picker-body">
                    <select id="year-picker"></select>
                    <select id="month-picker"></select>
                </div>
                <div class="picker-footer">
                    <button id="cancel-picker">キャンセル</button>
                    <button id="confirm-picker">OK</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", pickerHTML);

    let yearPicker = document.getElementById('year-picker');
    let monthPicker = document.getElementById('month-picker');

    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth() + 1;

    // 年の選択肢を動的に追加（2000年～2050年）
    for (let y = 2000; y <= 2050; y++) {
        let option = document.createElement('option');
        option.value = y;
        option.textContent = y + "年";
        if (y === currentYear) option.selected = true;
        yearPicker.appendChild(option);
    }

    // 月の選択肢を動的に追加（1月～12月）
    for (let m = 1; m <= 12; m++) {
        let option = document.createElement('option');
        option.value = m;
        option.textContent = m + "月";
        if (m === currentMonth) option.selected = true;
        monthPicker.appendChild(option);
    }

    document.getElementById('cancel-picker').addEventListener('click', function () {
        document.querySelector('.picker-overlay').remove();
    });

    document.getElementById('confirm-picker').addEventListener('click', function () {
        let selectedYear = parseInt(yearPicker.value);
        let selectedMonth = parseInt(monthPicker.value) - 1; // JavaScriptの月は0始まりなので調整
        document.querySelector('.picker-overlay').remove();
        loadCalendar(selectedYear, selectedMonth);
    });
}

function fetchThreadsByDate(selectedDate) {
    const recipientAddress = new sdkSymbol.Address('NB2TFCNBOXNG6FU2JZ7IA3SLYOYZ24BBZAUPAOA');
    document.getElementById('loading-spinner').style.display = 'block';

    // 過去のスレッドをクリア
    document.getElementById('thread-list').innerHTML = '';

    const params = new URLSearchParams({
        "address": recipientAddress.toString(),
        "pageSize": 100,
        "order": "desc"
    });

    fetch(new URL('/transactions/confirmed?' + params.toString(), NODE))
        .then(res => res.json())
        .then(data => {
            const txes = data.data;

            txes.forEach(tx => {
                const timestamp = epochAdjustment + (tx.meta.timestamp / 1000);
                const date = new Date(timestamp * 1000);
                const formattedTxDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                // 選択した日付のスレッドのみ表示
                if (formattedTxDate === selectedDate) {
                    appendThread(tx);
                }
            });

            document.getElementById('loading-spinner').style.display = 'none';
        })
        .catch(err => {
            console.error("スレッド取得エラー:", err);
            document.getElementById('loading-spinner').style.display = 'none';
        });
}

// 投稿があった日を取得する
let postDates = []; // ここで空の配列として定義

async function fetchPostDates() {
    const recipientAddress = new sdkSymbol.Address('NB2TFCNBOXNG6FU2JZ7IA3SLYOYZ24BBZAUPAOA');
    let allPostDates = [];  // すべての投稿日を保存する配列
    let pageNumber = 1;  // ページ番号の初期化
    let hasMoreData = true;  // データがまだあるかどうかのフラグ

    while (hasMoreData) {
        const params = new URLSearchParams({
            "address": recipientAddress.toString(),
            "pageSize": 100, // 1回の取得で最大100件
            "pageNumber": pageNumber, // ページ番号を適用
            "order": "desc" // 降順（新しい順）で取得
        });

        try {
            const response = await fetch(new URL('/transactions/confirmed?' + params.toString(), NODE));
            const data = await response.json();

            if (!data.data || data.data.length === 0) {
                hasMoreData = false; // データがなくなったらループ終了
                break;
            }

            // 投稿日を取得し、リストに追加
            data.data.forEach(tx => {
                const timestamp = epochAdjustment + (tx.meta.timestamp / 1000);
                const date = new Date(timestamp * 1000);
                const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                if (!allPostDates.includes(formattedDate)) { // 重複を防ぐ
                    allPostDates.push(formattedDate);
                }
            });

            // まだ100件あるなら、次のページを取得する
            if (data.data.length === 100) {
                pageNumber++;
            } else {
                hasMoreData = false; // 100件未満なら、もうデータがないのでループ終了
            }

        } catch (err) {
            console.error("投稿日の取得に失敗:", err);
            hasMoreData = false;
        }
    }

    // `postDates` に全ての取得した投稿日を格納
    postDates = allPostDates;
    console.log("投稿日一覧（全取得）:", postDates);
}


// LINE登録ウィンドウを開く
function openLineRegister() {
    const pubkey = window.SSS?.activePublicKey || '';
    const url = `https://xym-thread-notifications.vercel.app/api/line-register?pubkey=${pubkey}`;

    // 画面中央にポップアップ（420x680）
    const width = 420;
    const height = 680;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2 - 50; // 少し上め

    window.open(
        url,
        '_blank',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
}
