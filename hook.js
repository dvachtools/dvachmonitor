if(window.thread.id) {

    var data = {
        board: window.thread.board, 
        threadId: window.thread.id, 
        last_post: window.Post.call(window, window.thread.id).last().num,
        title: window.Post.call(window, window.thread.id).getTitle()
    };

    window.postMessage({ type: "thread-loaded", data: data }, "*");
}

// отправляем избранное ублюдня
window.postMessage({ type: "storage-favorites", data: JSON.parse(localStorage["store"]).favorites}, "*");

var favoritedThreads = [];

window.addEventListener('message', function(event) {
    if (event.data && event.data.extensionMessage) {
        favoritedThreads = Object.keys(event.data.extensionMessage);

        $('.thread').each(function(el){
             var num = $(this).attr('id').substr(7);
             if(Favorites.isFavorited(num)) {
                 Favorites.render_switch(num, true);
             } else {
                 Favorites.render_switch(num, false);
             }
         });
    }
});

Favorites.remove = function(num) {
    window.postMessage({ type: "thread-removed", data: {threadId: num} }, "*");
    //this.render_switch(num, false);
};

Favorites.add = function(num) {

    console.log(window.Post.call(window, num).getTitle());

    window.postMessage(
        {
            type: "thread-added",
            data: {
                threadId: num,
                title: window.Post.call(window, num).getTitle(),
                last_post: window.Post.call(window, num).last().num,
                board: window.thread.board,
                from_main: !window.thread.id
            }
    }, "*");

    //this.render_switch(num, true);
};

Favorites.render_show = function() {};

Favorites.isFavorited = function(num) {
    return $.inArray(num.toString(), favoritedThreads) >= 0;
};

/*$('.postbtn-favorite,#postbtn-favorite-bottom').die().live('click',function() {
    var num = $(this).data('num') || window.thread.id;

    console.log(num);
});*/

// всякие ссаки
window.addEventListener('focus', function() {
    if(!window.thread.id) return;
    console.log("focus");
    var data = {
        board: window.thread.board, 
        threadId: window.thread.id, 
        last_post: window.Post.call(window, window.thread.id).last().num,
        title: window.Post.call(window, window.thread.id).getTitle()
    };
    window.postMessage({ type: "window-focused", data: data }, "*");
});

window.addEventListener('blur', function() {
    if(!window.thread.id) return;

    console.log(window.thread.id);

    var data = {
        board: window.thread.board, 
        threadId: window.thread.id, 
        last_post: window.Post.call(window, window.thread.id).last().num,
        title: window.Post.call(window, window.thread.id).getTitle()
    };

    window.postMessage({ type: "window-blured", data: data }, "*");
});

window.addEventListener('beforeunload', function() {
    if(!window.thread.id) return;

    console.log(window.thread.id);

    var data = {
        board: window.thread.board, 
        threadId: window.thread.id, 
        last_post: window.Post.call(window, window.thread.id).last().num,
        title: window.Post.call(window, window.thread.id).getTitle()
    };

    window.postMessage({ type: "window-unload", data: data }, "*");
});