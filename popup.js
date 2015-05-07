$(function(){

    $(document).on("click", ".thread-link", function() {
        chrome.tabs.create({url: $(this).attr('href')});
        return false;
    });

    var height = $('body').css('height');

    $(".showhim").hover(function(){
        $('.showme').show();
        $('body').css('height', '300px');
    },function(){
        $('.showme').hide();
        $('body').css('height', height);
    });
});