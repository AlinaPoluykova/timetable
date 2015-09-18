define(['jquery', 'backbone', 'marionette', 'underscore', 'bootstrap', 'pouchdb', 'backbonePouch', 'moment'],
    function ($, Backbone, Marionette, _, bootstrap, PouchDB, backbonePouch, moment) {
        var App = new Backbone.Marionette.Application();

        //создаем регионы
        App.addRegions({
            headerRegion:"#header",//шапка с меню
            mainRegion:"#main"//контент
        });

        App.addInitializer(function (options) {
            Backbone.history.start();
        });

        //путь к базе CouchDB
        //App.db = new PouchDB('http://localhost:5984/timetable');

        //путь к реальной базе CouchDB
        App.db = new PouchDB('http://192.168.10.40:5984/timetable');

        Backbone.sync = BackbonePouch.sync({
            db: App.db
        });

        //в CouchDB вместо id используется _id
        Backbone.Model.prototype.idAttribute = '_id';

        window['moment'] = moment;//TODO костыль, чтобы timetable от vis.js не грузил свой moment.js, нужно разобраться
        moment.locale('ru');

        return App;
    });