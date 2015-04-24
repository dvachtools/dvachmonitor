if(window.thread.id) {

    var data = {
        board: window.thread.board, 
        threadId: window.thread.id, 
        last_post: window.Post.call(window, window.thread.id).last().num
    };

    window.postMessage({ type: "thread-loaded", data: data }, "*");
}

// отправляем избранное ублюдня
window.postMessage({ type: "storage-favorites", data: JSON.parse(localStorage["store"]).favorites}, "*");


var old = window.Gevent.emit;

// хукаем стандартную функцию добавления треда в избранную
window.Gevent.emit = function(name, data) {
    
    console.log(name);

    switch (name) {
        case 'fav.add':
            console.log("Added " + data);

            var threadData = {
                    num: data[0], 
                    board: data[1].board, 
                    title: data[1].title, 
                    last_post: data[1].last_post, 
                    from_main: !window.thread.id
                };

            window.postMessage({ type: "thread-added", data: threadData }, "*");
        break;

        case 'fav.remove':
            console.log("Removed " + data);
            window.postMessage({ type: "thread-removed", data: {num: data} }, "*");
        break
    }

    return old.apply(window.Gevent, [name, data]);
};


// всякие ссаки
window.addEventListener('focus', function() {
    if(!window.thread.id) return;
    console.log("focus");
    var data = {
        board: window.thread.board, 
        threadId: window.thread.id, 
        last_post: window.Post.call(window, window.thread.id).last().num
    };
    window.postMessage({ type: "window-focused", data: data }, "*");
});

window.addEventListener('blur', function() {
    if(!window.thread.id) return;

    console.log(window.thread.id);

    var data = {
        board: window.thread.board, 
        threadId: window.thread.id, 
        last_post: window.Post.call(window, window.thread.id).last().num
    };

    window.postMessage({ type: "window-blured", data: data }, "*");
});

window.addEventListener('beforeunload', function() {
    if(!window.thread.id) return;

    console.log(window.thread.id);

    var data = {
        board: window.thread.board, 
        threadId: window.thread.id, 
        last_post: window.Post.call(window, window.thread.id).last().num
    };

    window.postMessage({ type: "window-unload", data: data }, "*");
});