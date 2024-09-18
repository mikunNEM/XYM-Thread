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
        alert('メッセージと送金するXYMを確認してください');
        return;
    }

    // スレッドメッセージをSymbolのトランザクションとして送信
    sendThreadTransaction(message, amount);
}

// スレッドメッセージとXYMをSymbolブロックチェーンに送信する
function sendThreadTransaction(message, amount) {
    const recipientAddress = sym.Address.createFromRawAddress('NCAK7LZJDGQ3QW23SS475WOAGO66BNG6TO55R2Y');
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

    // トランザクションの署名と送信をaLiceアプリで行う
    const transactionPayload = tx.serialize();
    //const arrayBuffer = new TextEncoder().encode(`https://ventus-wallet.net/chat/index.html`);
    //const callback = Array.from(new Uint8Array(arrayBuffer), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    const aliceUrl = `alice://sign?data=${transactionPayload}&type=request_sign_transaction&node=${sym.Convert.utf8ToHex(NODE)}&method=announce`; //&deadline=3600&callback=${callback}`;
    window.location.href = aliceUrl;
}


// ページロード時にスレッドを表示する
window.addEventListener('load', displayThreads);

function displayThreads() {
    document.getElementById('loading-spinner').style.display = 'block'; // スピナーを表示

    const recipientAddress = sym.Address.createFromRawAddress('NCAK7LZJDGQ3QW23SS475WOAGO66BNG6TO55R2Y');

    txRepo.search({
        group: sym.TransactionGroup.Confirmed,
        address: recipientAddress,
        pageSize: 20,
        order: sym.Order.Desc,
    }).subscribe(threads => {
        const threadContainer = document.getElementById('thread-list');
        threadContainer.innerHTML = '';

        threads.data.forEach(tx => {
            if (tx.message && tx.message.payload) {
                console.log("tx=", tx);
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

                threadElement.innerHTML = `
                    <div class="thread-header">
                        <img src="${getRandomImage(tx.signer.publicKey)}" alt="Avatar" class="avatar">
                        <div class="thread-info">
                            <div class="thread-date">${ymdhms}</div>
                            <div class="thread-amount">${xymAmount} XYM</div>
                        </div>
                    </div>
                    <div class="thread-message" style="font-size: ${fontSize}px;">
                        ${tx.message.payload}
                    </div>
                    <button class="open-thread-button" data-hash="${tx.transactionInfo.hash}">スレッドを開く</button>
                `;

                threadContainer.appendChild(threadElement);


                document.querySelectorAll('.open-thread-button').forEach(button => {
                    button.addEventListener('click', function () {

                        const transactionHash = button.getAttribute('data-hash'); // トランザクションハッシュを取得
                        window.location.href = `thread.html?id=${transactionHash}`;  // 新しいページに遷移

                        const threadTitle = 'テストスレッド';
                        const avatarUrl = 'https://ventus-wallet.net/chat/avatar/1.png';

                        console.log(threadElement.querySelector('.open-thread-button'));


                        if (comments.length === 0) {
                            displayEmptyThread(threadTitle, avatarUrl);
                        } else {
                            displayThreadWithComments(threadTitle, avatarUrl, comments);
                        }
                    });
                });


            }
        });


        document.getElementById('loading-spinner').style.display = 'none'; // 読み込み完了後スピナーを非表示
    }, err => {
        console.error('トランザクション取得エラー:', err);
        document.getElementById('loading-spinner').style.display = 'none'; // エラー時もスピナーを非表示
    });
}


function getRandomImage(publicKey) {
    const hash = CryptoJS.SHA256(publicKey).toString();
    const index = parseInt(hash.slice(0, 8), 16) % 16 + 1; // ランダムに1-16の範囲の数値を生成
    return `https://ventus-wallet.net/chat/avatar/${index}.png`; // ランダムな画像URLを返す
}

const comments = [
    { avatarUrl: 'https://ventus-wallet.net/chat/avatar/1.png', date: '2024-09-14 12:00', text: '最初のコメントです。' },
    { avatarUrl: 'https://ventus-wallet.net/chat/avatar/2.png', date: '2024-09-14 13:00', text: '次のコメントです。' }
];


function displayEmptyThread(threadTitle, avatarUrl) {
    console.log('displayEmptyThreadが実行されました'); // 追加
    const threadContainer = document.getElementById('thread-container');
    threadContainer.innerHTML = `
        <div class="thread-popup">
            <img src="${avatarUrl}" alt="Avatar" class="avatar">
            <h2>${threadTitle}</h2>
            <p>まだコメントはありません。最初のコメントを書いてみませんか？</p>
            <button id="comment-button" class="comment-button">コメントする</button>
        </div>
    `;
}

function displayThreadWithComments(threadTitle, avatarUrl, comments) {
    console.log('displayThreadWithCommentsが実行されました'); // 追加
    // thread-container が存在しない場合は作成
    let threadContainer = document.getElementById('thread-container');
    if (!threadContainer) {
        threadContainer = document.createElement('div');
        threadContainer.id = 'thread-container';
        document.body.appendChild(threadContainer); // 必要な場所に追加
    }

    let commentsHtml = '';

    comments.forEach(comment => {
        commentsHtml += `
            <div class="comment">
                <img src="${comment.avatarUrl}" alt="Avatar" class="avatar">
                <div class="comment-details">
                    <p>${comment.date}</p>
                    <p>${comment.text}</p>
                </div>
            </div>
        `;
    });

    threadContainer.innerHTML = `
        <div class="thread-popup">
            <img src="${avatarUrl}" alt="Avatar" class="avatar">
            <h2>${threadTitle}</h2>
            ${commentsHtml}
            <button id="comment-button" class="comment-button">コメントする</button>
        </div>
    `;

    console.log('thread-container: ', document.getElementById('thread-container'));


}



function sendCommentTransaction(thread_owner, message, amount) {
    const recipientAddress = sym.Address.createFromRawAddress(thread_owner); // スレッド作成者のアドレスにコメントを送信
    const plainMessage = sym.PlainMessage.create(message);

    // 送金するXYMの量を指定
    const mosaic = new sym.Mosaic(
        new sym.MosaicId("6BED913FA20223F8"), // SymbolのXYMのモザイクID
        sym.UInt64.fromUint(amount * Math.pow(10, 6)) // XYMの最小単位で指定
    );

    const tx = sym.TransferTransaction.create(
        sym.Deadline.create(epochAdjustment),
        recipientAddress,  // 指定されたアドレスにコメントを送信
        [mosaic], // 送金するXYMを指定
        plainMessage,
        sym.NetworkType.MAIN_NET
    ).setMaxFee(100);

    // トランザクションの署名と送信を行う
    const transactionPayload = tx.serialize();
    const aliceUrl = `alice://sign?data=${transactionPayload}&type=request_sign_transaction&node=${sym.Convert.utf8ToHex(NODE)}&method=announce`;
    window.location.href = aliceUrl;
}
