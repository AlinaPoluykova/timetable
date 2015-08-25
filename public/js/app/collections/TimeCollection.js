define(["jquery", "backbone", "models/TimeModel"],
    function ($, Backbone, Model) {
        // Creates a new Backbone Collection class object
        var Collection = Backbone.Collection.extend({
            // Tells the Backbone Collection that all of it's models will be of type Model (listed up top as a dependency)
            initialize: function(params){
                // console.log(params);
                //TODO использовать _.template
                this.pouch.options.query.fun.map = "function (doc) {" +
                    "if (doc.type === 'time' && doc.start >= " + params.from + " && doc.start <= " + params.to + ") {" +
                        "emit(doc)" +
                    "}" +
                "}";
            },
            from: undefined,
            to: undefined,
            model: Model,
            pouch: {
                listen: false,
                fetch: 'query',
                options: {
                    query: {
                        include_docs: true,
                        fun: {
                            map: function (doc) {
                                if (doc.type === 'time') {
                                    emit(doc)
                                }
                            }
                        }
                    },
                    changes: {
                        include_docs: true,
                        filter: function (doc) {
                            return doc._deleted || doc.type === 'time';
                        }
                    }
                }
            },
            parse: function (result) {
                return _.pluck(result.rows, 'doc');
            },
            getLast: function(attr, value){
                var last = undefined;
                $.each(this.models, function(index, model){
                    if(model.get(attr) == value){
                        if(!last){
                            last = model;
                        } else {
                            if(model.get("start") > last.get("start")){
                                last = model;
                            }
                        }
                    }
                });
                return last;
            }
        });

        return Collection;
    });