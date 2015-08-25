define(['App', 'backbone', 'marionette', 'moment', 'views/WorkView', 'views/HeaderView', 'views/ReportView', 'views/EmployeeView'],
    function (App, Backbone, Marionette, moment, WorkView, HeaderView, ReportView, EmployeeView) {
    return Backbone.Marionette.Controller.extend({
        initialize:function (options) {
            App.headerRegion.show(new HeaderView());
            // вычисляем разницу между сейчас и 00 и задаем на этот период setTimout для перезагрузки страницы
            var now = new Date();
            var reloadDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            var diff = reloadDate.getTime() - now.getTime();
            setTimeout(function(){ location.reload(); }, diff);
            

        },

        //страница с рабочим временем
        index:function (date) {
            App.mainRegion.show(new WorkView({date: date}));
        },

        //страница создания сотрудников
        employee: function(){
            App.mainRegion.show(new EmployeeView());
        },

        //страница создания отчётов
        report: function(){
            App.mainRegion.show(new ReportView());
        }
    });
});