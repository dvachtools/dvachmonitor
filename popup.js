$(function(){
    chrome.runtime.sendMessage({ type: "popup-request" }, function(data) {

        console.log("Got popup-response");
        console.log(data.state);
        console.log(data.threads);

        render(data.threads, data.state);
    });

    var div_default_content =  $('#links-div').html();

    var hoveredOver = null;

    function render(threads, addableThread) {
        var sorted = _.sortBy(threads, function(thread) { return thread.board; });
        sorted = _.sortBy(sorted, function(thread) { return -thread.unread; });

        var content_div = $('#links-div');

        if(sorted.length  == 0) {
            content_div.html(div_default_content);

        } else {

            content_div.empty();

            renderLinks(sorted);

            $('.read-btn').on('click', function () {
                $(this).attr('src', 'images/ok_pending.png');
                markAsRead($(this).attr('thread-id'));
            });

            $('.update-btn').on('click', function () {
                $(this).attr('src', 'images/reload_pending.png');
                updateThread($(this).attr('thread-id'));
            });

            $('.update-all-btn').on('click', function () {
                $(this).attr('src', 'images/reload_pending.png');
                updateAll();
            });

            $('.remove-thread-btn').on('click', function () {
                //$(this).attr('src', 'images/reload_pending.png');

                chrome.runtime.sendMessage({ type: "remove-thread", data: {threadId: $(this).attr('thread-id')} }, function(response){
                    render(response.threads, response.state);
                });
            });
        }

        if(addableThread.addable) {
            content_div.append("<div style='position: absolute; left: 460px; top: 0'><img src='images/plus.png' class='add-thread-btn' " +
                "style='cursor:pointer;width: 24px; height: 24px' title='Добавить тред " + addableThread.threadData.title + "' alt='Добавить тред'></div>");

            $('.add-thread-btn').on('click', function () {
                //$(this).attr('src', 'images/reload_pending.png');

                chrome.runtime.sendMessage({ type: "add-current-thread" }, function(response){
                    render(response.threads, response.state);
                });
            });
        }

        $('.thread-link').on('click', function () {
            chrome.tabs.create({url: $(this).attr('href')});
            return false;
        }).on('mouseover', function(e) {
            hoveredOver =  $(e.currentTarget);
        }).on('mouseout', function(e) {
            hoveredOver = null;
        });
    }

    $(document).keypress(function(e) {
        if (e.which == 127 && hoveredOver) {
            console.log(hoveredOver.attr('thread-id'));
            chrome.runtime.sendMessage({ type: "remove-thread", data: {threadId: hoveredOver.attr('thread-id')} }, function(response){
                render(response.threads, response.state);
            });
        }
    });

    function markAsRead(num) {
        console.log("markAsRead " + num);
        chrome.runtime.sendMessage({ type: "popup-markasread", data: {threadId: num} }, function(response){
            render(response.threads, response.state);
        });
    }

    function updateAll() {
        chrome.runtime.sendMessage({ type: "popup-update-all" }, function(response){
            render(response.threads, response.state);
        });
    }

    function openAllUnread() {
//        chrome.runtime.sendMessage({ type: "popup-open-unread" }, function(){});
    }

    function updateThread(num) {
        chrome.runtime.sendMessage({ type: "popup-update", data: {num: num} }, function(response){
            render(response.threads)
        });
    }

    function urlhtml(board, num, first_unread) {
        return "http://2ch.hk/" + board + "/res/" + num + ".html#" + ((_.isUndefined(first_unread))? "bottom" : first_unread);
    }

    function renderLinks(threads) {
        var sorted = _.sortBy(threads, function(thread) { return -thread.unreads; });
        var links = $('#links-div');

        links.append("<div style='position: absolute; left: 490px; top: 0'><img src='images/reload.png' class='update-all-btn' " +
            "style='cursor:pointer;width: 24px; height: 24px' title='Обновить все' alt='Обновить все'></div>");

        for(key in sorted) {
            var thread = sorted[key];
            
            // console.log(key, thread);
            // var div_template = '<div> I am <span id="age"></span> years old!</div>';
            links.append(renderLinkRow(thread.board, thread.num, thread.unread, thread.title, thread.not_found_errors, thread.errors, thread.first_unread));

        }
    }

    function renderLinkRow(board, num, unreads, title, not_found_errors, errors, first_unread) {
        var style = unreads > 0 ? "style='font-weight: bold'":"";

        var errors_status = vsprintf("%s%s", [not_found_errors > 0 ? " 404 ":"", errors > 0 ? " <span style='color:red'>err</span> ":""]);

        var markAsReadButton = vsprintf(" <img title='Отметить как прочитанное' src='images/ok.png' style='cursor:pointer;width: 12px; height: 12px' class=read-btn thread-id=%d>", [num]);

        var preinfo = unreads > 0 ? vsprintf("%s(<span %s>%d</span>) ", [markAsReadButton, style, unreads]) : "";

        /*preinfo = vsprintf("<img title='удалить' src='images/delete.png' " +
            "style='cursor:pointer;width: 12px; height: 12px' class=remove-thread-btn thread-id=%d>", [num]) + preinfo;*/

        //var updateButton = vsprintf(" <img title='Обновить' style='cursor: pointer;width: 12px; height: 12px' src='images/reload.png' class=update-btn thread-id=%d> ", [num]);
        
    /*    return vsprintf("<div>(<span %s>%d</span>)%s%s%s<a class=thread-link href='%s' %s> /%s/%d - %s </a></div>",
            [style, unreads, markAsReadButton, updateButton, errors_status, urlhtml(board, num, first_unread), style, board, num, title]);*/

        return vsprintf("<div class='link-div'>%s%s<a title='Нажми Delete, чтобы удалить' class=thread-link thread-id=%d href='%s' %s> /%s/%d - %s </a></div>",
            [preinfo, errors_status, num, urlhtml(board, num, first_unread), style, board, num, title]);

    }

});