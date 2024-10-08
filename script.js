const sym = require('/node_modules/symbol-sdk');
const NODE = 'https://symbol-mikun.net:3001'; // ノードURL
const Repo = new sym.RepositoryFactoryHttp(NODE);
const txRepo = Repo.createTransactionRepository();
const epochAdjustment = 1615853185;

// モーダルを開く
//document.addEventListener('DOMContentLoaded', function () {
document.getElementById('open-modal').addEventListener('click', function () {
    document.getElementById('modal').style.display = 'flex'; // flexで中央配置
});


// モーダルを閉じる
document.querySelector('.close').addEventListener('click', function () {
    document.getElementById('modal').style.display = 'none';
});

// モーダル外をクリックした場合も閉じる
window.addEventListener('click', function (event) {
    if (event.target == document.getElementById('modal')) {
        document.getElementById('modal').style.display = 'none';
    }
});



// 作成ボタンを押すとaLiceでトランザクションを送信
document.getElementById('create-thread-button').addEventListener('click', createThread);

//});

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
    const recipientAddress = sym.Address.createFromRawAddress('NB2TFCNBOXNG6FU2JZ7IA3SLYOYZ24BBZAUPAOA');
    const plainMessage = sym.PlainMessage.create(message);

    // 送金するXYMの量を指定
    const mosaic = new sym.Mosaic(
        new sym.MosaicId("6BED913FA20223F8"), // SymbolのXYMのモザイクID
        sym.UInt64.fromUint(amount * Math.pow(10, 6)) // XYMの最小単位で指定
    );

    const tx = sym.TransferTransaction.create(
        sym.Deadline.create(epochAdjustment),
        recipientAddress,  // 指定されたアカウント宛にメッセージを送信
        [mosaic], // 送金するXYMを指定
        plainMessage,
        sym.NetworkType.MAIN_NET
    ).setMaxFee(100);

    if (window.innerWidth <= 768) {  // ウィンドウサイズで aLice / SSS を切り替える。
        const transactionPayload = tx.serialize();
        //const arrayBuffer = new TextEncoder().encode(`https://ventus-wallet.net/chat/index.html`);
        //const callback = Array.from(new Uint8Array(arrayBuffer), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
        const aliceUrl = `alice://sign?data=${transactionPayload}&type=request_sign_transaction&node=${sym.Convert.utf8ToHex(NODE)}&method=announce`; //&deadline=3600&callback=${callback}`;
        window.location.href = aliceUrl;
    } else {
        window.SSS.setTransaction(tx);
        window.SSS.requestSign().then(signedTx => {   // SSSを用いた署名をユーザーに要求
            console.log('signedTx', signedTx);
            txRepo.announce(signedTx).subscribe(() => {
                Swal.fire({
                    title: 'Success!',
                    text: 'アナウンスが送信されました！',
                    icon: 'success',
                    confirmButtonText: 'OK'
                });
            });
        })
    }
}

// ふさわしくない投稿リスト
const badThreadList = ['',
                       '', 
                       '']; // ふさわしくない投稿のトランザクションハッシュを追加

// ページロード時にスレッドを表示する
window.addEventListener('load', displayThreads);

function displayThreads() {
    document.getElementById('loading-spinner').style.display = 'block'; // スピナーを表示
    const recipientAddress = sym.Address.createFromRawAddress('NB2TFCNBOXNG6FU2JZ7IA3SLYOYZ24BBZAUPAOA');
    let pageNumber = 1;
    const threadContainer = document.getElementById('thread-list');
    threadContainer.innerHTML = ''; // コンテナをクリア

    function fetchTransactions(pageNumber) {
        txRepo.search({
            group: sym.TransactionGroup.Confirmed,
            address: recipientAddress,
            pageSize: 100, // 1ページあたりの最大取得数
            pageNumber: pageNumber, // 現在のページ
            order: sym.Order.Desc,
        }).subscribe(threads => {
            if (threads.data.length === 0) {
                document.getElementById('loading-spinner').style.display = 'none'; // データがない場合は終了
                return;
            }

            threads.data.forEach(tx => {
                // ふさわしくない投稿かどうかを確認
                if (badThreadList.includes(tx.transactionInfo.hash)) {
                    return; // ふさわしくない投稿は表示しない
                }
                if (tx.message && tx.message.payload) {
                    console.log("tx.hash=", tx.transactionInfo.hash);
                    const threadElement = document.createElement('div');
                    threadElement.className = 'thread-item';

                    const timestamp = epochAdjustment + (parseInt(tx.transactionInfo.timestamp.toHex(), 16) / 1000);
                    const date = new Date(timestamp * 1000);

                    const yyyy = `${date.getFullYear()}`;
                    const MM = `0${date.getMonth() + 1}`.slice(-2);
                    const dd = `0${date.getDate()}`.slice(-2);
                    const HH = `0${date.getHours()}`.slice(-2);
                    const mm = `0${date.getMinutes()}`.slice(-2);
                    const ss = `0${date.getSeconds()}`.slice(-2);

                    const ymdhms = `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;

                    const xymAmount = tx.mosaics[0].amount.compact() / Math.pow(10, 6);
                    const fontSize = Math.min(10 + xymAmount * 10, 50);

                    const linkedMessage = convertURLsToLinks(tx.message.payload);

                    threadElement.innerHTML = `
                        <div class="thread-header">
                            <img src="${getRandomImage(tx.signer.publicKey)}" alt="Avatar" class="avatar">
                            <div class="thread-info">
                                <div class="thread-date">${ymdhms}</div>
                                <div class="thread-amount">${xymAmount} XYM</div>
                            </div>
                        </div>
                        <div class="thread-message" style="font-size: ${fontSize}px;">
                            ${linkedMessage}
                        </div>
                        <br>
                        <button class="open-thread-button" data-hash="${tx.transactionInfo.hash}">スレッドを開く</button>
                    `;

                    threadContainer.appendChild(threadElement);

                    document.querySelectorAll('.open-thread-button').forEach(button => {
                        button.addEventListener('click', function () {
                            const transactionHash = button.getAttribute('data-hash'); // トランザクションハッシュを取得
                            window.location.href = `thread.html?id=${transactionHash}`;  // 新しいページに遷移
                        });
                    });
                }
            });

            // 次のページのトランザクションを取得
            pageNumber++;
            fetchTransactions(pageNumber);
        }, err => {
            console.error('トランザクション取得エラー:', err);
            document.getElementById('loading-spinner').style.display = 'none'; // エラー時もスピナーを非表示
        });
    }

    // 最初のページの取得を開始
    fetchTransactions(pageNumber);
}

function getRandomImage(publicKey) {
    const hash = CryptoJS.SHA256(publicKey).toString();
    const index = parseInt(hash.slice(0, 8), 16) % 16 + 1; // ランダムに1-16の範囲の数値を生成
    return `https://xym-thread.com/avatar/${index}.png`; // ランダムな画像URLを返す
}

function byteLengthUTF8(s) {
    return new TextEncoder().encode(s).length;
}

function convertURLsToLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<br><br><a href="$1" target="_blank">➡️詳細はこちらから</a>');
}



