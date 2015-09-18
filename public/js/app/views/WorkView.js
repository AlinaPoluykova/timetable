define([
    'App',
    'marionette',
    'underscore',
    'models/TimeModel',
    'collections/TimeCollection',
    'collections/EmployeeCollection',
    'text!templates/work.html',
    'material',
    'ripples',
    'moment',
    'vis',
    'velocity',
    'text!templates/group.html',
    'text!templates/groupHistory.html',
    'webcam',
    'injectCSS',
    'eon-timepicker'
], function (App, Marionette, _, TimeModel, TimeCollection, EmployeeCollection, template, material, ripples, moment, vis, velocity, groupTemplate, groupHistoryTemplate, webcam, injectCSS, eontimepicker) {
    return Marionette.ItemView.extend({

        template: _.template(template),

        day: undefined,

        isHistory: false,

        timeline: undefined,

        groups: undefined,

        items: undefined,

        employeeCollection: new EmployeeCollection(),

        timeCollection: undefined,

        ui: {
            workButton: ".workButton",
            breakButton: ".breakButton",
            cancelButton: "#cancelButton",
            faultButton: ".faultButton",

            webcamAction: "#webcamAction",
            webcamName: "#webcamName",
            webcamTime: "#webcamTime",

            dayInput: "#inputDay",
            datePickerWork: "#datepicker-work"
        },

        initialize: function (params) {
            if (params && params.date) {
                var day = moment(params.date);
                if (day.isValid()) {
                    this.day = day;
                    if (day.isSame(new Date(), "day")) {
                        this.isHistory = false;
                    } else {
                        this.isHistory = true;
                    }
                } else {
                    this.day = moment();
                    this.isHistory = false;
                }
            } else {
                this.day = moment();
                this.isHistory = false;
            }

            var yesterday = moment().subtract(1, 'day');
            this.historyCollection = new TimeCollection([],{
                    from: yesterday.startOf('day').unix(),
                    to: yesterday.endOf('day').unix()
                }
            );

            this.timeCollection = new TimeCollection([],{
                    from: this.day.startOf('day').unix(),
                    to: this.day.endOf('day').unix()
                }
            );
        },

        events: {
            'click @ui.workButton': 'workButtonClick',
            'click @ui.breakButton': 'breakButtonClick',
            'click @ui.cancelButton': 'cancelButtonClick',
            'click @ui.faultButton': 'faultButtonClick'
        },

        changeDate: function (e) {
            var date = moment(this.ui.dayInput.val());
            if (!date.isValid()) {
                date = moment();
                this.ui.dayInput.val(date.format("YYYY-MM-DD"));
                // this.ui.dayInput.datetimepicker();
            }
            window.location.href = "index.html#work/" + this.ui.dayInput.val();
        },

        onAttach: function () {
            var that = this;
            this.loadEmployees();
            $.material.init();
            this.ui.dayInput.val(this.day.format("YYYY-MM-DD"));
            var day = this.ui.dayInput.datetimepicker({format: "YYYY-MM-DD"});
            this.ui.dayInput.on('dp.change', function (e) {
                that.changeDate()
            })
        },

        loadEmployees: function () {
            var that = this;
            this.employeeCollection.fetch({
                success: function (collection) {
                    //если отображаем текущий день
                    if (!that.isHistory) {
                        that.createEmployeeGroups(collection.models);
                        that.historyCollection.fetch({
                            success: function(collection){
                                that.createItems();
                            }
                        });
                        //если отображаем день из истории
                    } else {
                        that.createEmployeeHistoryGroups(collection.models);
                        that.createItems();
                    }
                }
            });
        },

        createEmployeeGroups: function (employees) {
            var employeeGroups = [];
            $.each(employees, function (index, employee) {
                var employeeGroup = {
                    id: employee.get("_id"),
                    content: _.template(groupTemplate)({employee: employee, working: false, breaking: false})
                };
                employeeGroups.push(employeeGroup);
            });
            this.groups = new vis.DataSet(employeeGroups);
        },

        createEmployeeHistoryGroups: function (employees) {
            var employeeGroups = [];
            $.each(employees, function (index, employee) {
                var employeeGroup = {
                    id: employee.get("_id"),
                    content: _.template(groupHistoryTemplate)({employee: employee})
                };
                employeeGroups.push(employeeGroup);
            });
            this.groups = new vis.DataSet(employeeGroups);
        },

        getItemsFromCollection: function (collection) {
            var times = [];

            $.each(collection.models, function (index, time) {
                times.push(time.toItem());
                if (time.get("mode") == "work") {
                    var injection = {};
                    if (time.has("photoStart") && !time.has("photoEnd")) {
                        injection[".vis-item.vis-background.work.id" + time.get("_id")] = {
                            "background-image": 'url(' + time.get("photoStart") + ')'
                        };
                    } else if (time.has("photoStart") && time.has("photoEnd")) {
                        injection[".vis-item.vis-background.work.id" + time.get("_id")] = {
                            "background-image": 'url(' + time.get("photoStart") + '), url(' + time.get("photoEnd") + ')'
                        };
                    }
                    $.injectCSS(injection);
                }
            });
            return times;
        },

        createItems: function () {
            var that = this;
            this.timeCollection.fetch({
                success: function (collection) {
                    that.items = new vis.DataSet(that.getItemsFromCollection(collection));
                    that.fillTimeline(that.groups, that.items, that.day);

                    if (!that.isHistory) {
                        //проставляем текущее состояние работника по последней активности
                        $.each(that.employeeCollection.models, function (index, employee) {
                            var lastActivity = collection.getLast("employeeId", employee.get("_id"));
                            if (lastActivity && !lastActivity.has("end")) {
                                employee.set("state", lastActivity.get("mode"));
                            } else {
                                employee.unset("state");
                            }
                            that.updateEmployeeState(employee);
                        });

                        //запускаем отрисовку времени
                        that.startTimeTracker();
                        //запускаем проверку оповещений
                        that.startNotificationChecker(5 * 60 * 1000);
                    } else {
                        var employeeTime = {};

                        $.each(that.employeeCollection.models, function (index, employee) {
                            employeeTime[employee.get("_id")] = {work: 0, break: 0};
                        });

                        $.each(collection.models, function (index, time) {
                            var periodInSeconds = (time.get("end") - time.get("start"));
                            employeeTime[time.get("employeeId")][time.get("mode")] += periodInSeconds;
                            if (time.has("late")) {
                                employeeTime[time.get("employeeId")].late = time.get("late");
                            }
                        });

                        $.each(employeeTime, function (employeeId, data) {
                            function pad(num, size) {
                                return ('000000000' + num).substr(-size);
                            }

                            var workInfo = pad(Math.floor(data.work / 60 / 60), 2) + ":" + pad(Math.floor(data.work / 60 % 60), 2);
                            var breakInfo = pad(Math.floor(data.break / 60 / 60), 2) + ":" + pad(Math.floor(data.break / 60 % 60), 2);

                            $(".workLabel[data-employeeid='" + employeeId + "']").html(workInfo);
                            $(".breakLabel[data-employeeid='" + employeeId + "']").html(breakInfo);

                            if (data.late) {
                                var lateInfo = "Опоздание " + data.late;
                                $(".lateLabel[data-employeeid='" + employeeId + "']").html(lateInfo);
                            }
                        });

                    }
                }
            });
        },

        startNotificationChecker: function (interval) {
            var that = this;
            setInterval(function () {
                that.checkNotification();
            }, interval);
        },

        checkNotification: function () {
            var that = this;
            $.each(that.employeeCollection.models, function (index, employee) {
                if (employee.has("notifyOnBreak") && !that.employeeHasBreak(employee)) {
                    if (that.getEmployeeWorkingTimeInSeconds(employee) >= 5 * 60 * 60) {
                        that.showBreakNotification(employee);
                    }
                }
                if (employee.has("notifyOnEnd")) {
                    if (that.getEmployeeWorkingTimeInSeconds(employee) >= 8 * 60 * 60) {
                        that.showEndNotification(employee);
                    }
                }
            });
        },

        employeeHasBreak: function (employee) {
            var result = this.timeCollection.find(function (model) {
                return model.get('employeeId') == employee.get("_id") && model.get("mode") == "break";
            });
            return !result;
        },

        getEmployeeWorkingTimeInSeconds: function (employee) {
            var result = 0;
            $.each(this.timeCollection.models, function (index, time) {
                if (time.get('employeeId') == employee.get("_id") && time.get("mode") == "work") {
                    var start = time.get("start");
                    var end = time.get("end");
                    if (end == undefined) {
                        end = moment().unix();
                    }
                    result += (end - start);
                }
            });
            return result;
        },

        startTimeTracker: function () {
            var that = this;
            //TODO костыль — влезаем во внутренности Timeline, иначе анимация не будет плавной
            this.timeline.body.emitter.off("currentTime").on("currentTime", function (e) {
                that.items.forEach(function (item) {
                    if (item.className.search("active") != -1) {
                        item.end = moment();
                        that.items.update(item);
                    }
                });
            });
        },

        fillTimeline: function (groups, items, day) {
            var container = this.$el.find('#visualization')[0];
            var options = {
                start: moment.unix(day.startOf('day').unix()),
                end: moment.unix(day.endOf('day').unix()),
                min: moment.unix(day.startOf('day').unix()),
                max: moment.unix(day.endOf('day').unix()),
                editable: false,
                stack: false,
                moveable: true,
                zoomable: true,
                locales: {
                    ru: {
                        current: 'текущее',
                        time: 'время'
                    }
                },
                locale: "ru"
            };

            this.timeline = new vis.Timeline(container, items, groups, options);
        },

        updateEmployeeState: function (employee) {
            var $workButton = $('.workButton[data-employeeid="' + employee.get("_id") + '"]');
            var $breakButton = $('.breakButton[data-employeeid="' + employee.get("_id") + '"]');
            switch (employee.get("state")) {
                case 'work':
                    $workButton.removeClass('btn-material-grey').addClass('btn-material-green');
                    $breakButton.removeClass('btn-material-red').addClass('btn-material-grey');
                    break;
                case 'break':
                    $workButton.removeClass('btn-material-green').addClass('btn-material-grey');
                    $breakButton.removeClass('btn-material-grey').addClass('btn-material-red');
                    break;
                default:
                    $workButton.removeClass('btn-material-green').addClass('btn-material-grey');
                    $breakButton.removeClass('btn-material-red').addClass('btn-material-grey');
                    break;
            }
        },

        breakButtonClick: function (e) {
            var employeeId = $(e.target).data("employeeid");
            var employee = this.employeeCollection.get(employeeId);
            if (employee.get("state") == 'work') {
                this.startBreak(employee);
            } else if (employee.get("state") == 'break') {
                this.continueWork(employee);
            }
        },

        workButtonClick: function (e) {
            var employeeId = $(e.target).data("employeeid");
            var employee = this.employeeCollection.get(employeeId);
            if (employee.get("state") == 'work') {
                this.finishWork(employee);
            } else if (employee.get("state") == 'break') {
                this.continueWork(employee);
            } else {
                this.startWork(employee);
            }
        },

        faultButtonClick: function (e) {
            var employeeId = $(e.target).data("employeeid");
            var employee = this.employeeCollection.get(employeeId);
            if (employee.get("state") == 'work') {
                this.finishWithFault(employee);
            }
        },

        isFirstStartForEmployee: function (employee) {
            var result = this.timeCollection.find(function (model) {
                return model.get('employeeId') == employee.get("_id");
            });
            return !result;
        },

        isFaultEmployee: function(employee) {
            var result = false;
            $.each(this.historyCollection.models, function (index, time) {
                if (time.get('employeeId') == employee.get("_id") && time.get("mode") == "work" && time.has('fault')) {
                    result = time.get('fault');
                }
            });
            return result;
        },

        startWork: function (employee) {
            var isFirst = this.isFirstStartForEmployee(employee);
            var isFault = this.isFaultEmployee(employee);
            if(isFault){
                $("#monkey")[0].play();
                $(".well.bs-component").removeClass("fault").addClass("fault");
            } else {
                $(".well.bs-component").removeClass("fault");
            }

            var time = new TimeModel({
                employeeId: employee.get("_id"),
                start: moment().unix(),
                end: undefined,
                mode: 'work', //'work' or 'break'
                active: true,
                type: "time"
            });
            time.set("_id", time.get("employeeId") + "-" + time.get("start"));

            //TODO DRY
            var that = this;
            var params = {
                name: employee.get("name"),
                time: moment().format('HH:mm'),
                action: "Начать смену"
            };
            $("#confirmButton").off("click").on("click", function () {
                that.takeSnapshot(time);
                that.items.add(time.toItem());
                employee.set("state", "work");
                that.updateEmployeeState(employee);
                //если рабочий период у сотрудника первый за день, то проверяем и фиксируем опоздание
                if (isFirst) {
                    if (employee.has("timeStart")) {
                        var timeStartStr = employee.get("timeStart");
                        var timeStartMin = parseInt(timeStartStr.split(":")[0]) * 60 + parseInt(timeStartStr.split(":")[1]);
                        var timeStart = new moment(this.day).startOf("day").add(timeStartMin, 'minutes');
                        var now = new moment();
                        var late = now.diff(timeStart, 'minutes');
                        var lateStr = undefined;
                        if (late > 0) {
                            lateStr = Math.round(late / 60) + ":" + late % 60;
                        }
                        time.set("late", lateStr);
                    }
                }
            });
            this.showCameraDialog(params);

        },

        showBreakNotification: function (employee) {
            Notification.requestPermission(function (permission) {
                var notification = new Notification(employee.get("name"), {
                    tag: "break",
                    body: "Пора сделать перерыв на обед!",
                    icon: "img/dinner.png"
                });
                setTimeout(function () {
                    notification.cancel();
                }, 2 * 60 * 1000);
            });
        },

        showEndNotification: function (employee) {
            Notification.requestPermission(function (permission) {
                var notification = new Notification(employee.get("name"), {
                    tag: "work",
                    body: "Пора заканчивать смену!",
                    icon: "img/exit.png"
                });
                setTimeout(function () {
                    notification.cancel();
                }, 2 * 60 * 1000);
            });
        },

        finishWork: function (employee) {
            var timestamp = moment().unix();
            var time = this.timeCollection.getLast("employeeId", employee.get("_id"));

            //TODO DRY
            var that = this;
            var params = {
                name: employee.get("name"),
                time: moment().format('HH:mm'),
                action: "Закончить смену"
            };
            $("#confirmButton").off("click").on("click", function () {
                time.set("end", timestamp);
                that.takeSnapshot(time);
                var list = that.items.get({
                    filter: function (item) {
                        return item.group == employee.get("_id");
                    }
                });
                var item = list[list.length - 1];
                item.end = moment.unix(timestamp);
                item.className = item.className.replace(' active', '');
                that.items.update(item);
                employee.unset("state");
                that.updateEmployeeState(employee);
            });
            this.showCameraDialog(params);
        },

        finishWithFault: function (employee) {
            var timestamp = moment().unix();
            var time = this.timeCollection.getLast("employeeId", employee.get("_id"));

            var that = this;
            if(time.get("mode")=='work' && !time.has("end")) {
                time.set("end", timestamp);
                that.markAsFault(time);
                var list = that.items.get({
                    filter: function (item) {
                        return item.group == employee.get("_id");
                    }
                });
                var item = list[list.length - 1];
                item.end = moment.unix(timestamp);
                item.className = item.className.replace(' active', '');
                that.items.update(item);
                employee.unset("state");
                that.updateEmployeeState(employee);
            }
        },

        startBreak: function (employee) {
            var timestamp = moment().unix();
            var time = this.timeCollection.getLast("employeeId", employee.get("_id"));

            //TODO DRY
            var that = this;
            var params = {
                name: employee.get("name"),
                time: moment().format('HH:mm'),
                action: "Перерыв на обед"
            };
            $("#confirmButton").off("click").on("click", function () {
                time.set("end", timestamp);
                that.takeSnapshot(time);
                var list = that.items.get({
                    filter: function (item) {
                        return item.group == employee.get("_id");
                    }
                });
                var item = list[list.length - 1];
                item.end = moment.unix(timestamp);
                item.className = item.className.replace(' active', '');
                that.items.update(item);

                var dinner = new TimeModel({
                    _id: employee.get("_id") + "-" + timestamp,
                    employeeId: employee.get("_id"),
                    start: timestamp,
                    end: undefined,
                    mode: 'break', //'work' or 'break'
                    active: true,
                    type: "time"
                });
                that.timeCollection.create(dinner);
                that.items.add(dinner.toItem());
                employee.set("state", "break");
                that.updateEmployeeState(employee);
            });
            this.showCameraDialog(params);
        },

        continueWork: function (employee) {
            var timestamp = moment().unix();
            var time = this.timeCollection.getLast("employeeId", employee.get("_id"));


            var that = this;
            var params = {
                name: employee.get("name"),
                time: moment().format('HH:mm'),
                action: "Продолжить смену"
            };
            $("#confirmButton").off("click").on("click", function () {
                time.save({"end": timestamp});
                var list = that.items.get({
                    filter: function (item) {
                        return item.group == employee.get("_id");
                    }
                });
                var item = list[list.length - 1];
                item.end = moment.unix(timestamp);
                item.className = item.className.replace(' active', '');
                that.items.update(item);

                var work = new TimeModel({
                    _id: employee.get("_id") + "-" + timestamp,
                    employeeId: employee.get("_id"),
                    start: timestamp,
                    end: undefined,
                    mode: 'work', //'work' or 'break'
                    active: true,
                    type: "time"
                });
                that.takeSnapshot(work);
                that.timeCollection.create(work);
                that.items.add(work.toItem());
                employee.set("state", "work");
                that.updateEmployeeState(employee);
            });
            this.showCameraDialog(params);
        },

        takeSnapshot: function (time) {
            var that = this;
            var time_id = time.get("_id");
            webcam.snap(function (data_uri) {
                var injection = {};
                if (!time.has("end")) {
                    time.set("photoStart", data_uri);
                    that.timeCollection.create(time);
                    injection[".vis-item.vis-background.work.id" + time_id] = {
                        "background-image": 'url(' + data_uri + ')'
                    };
                } else {
                    time.save({"end": time.get("end"), "photoEnd": data_uri});
                    var currentBg = $(".vis-item.vis-background.work.id" + time_id).css('background-image');
                    injection[".vis-item.vis-background.work.id" + time_id] = {
                        "background-image": currentBg + ', url(' + data_uri + ')'
                    };
                }
                $.injectCSS(injection);
                $('.overlay').velocity({opacity: 0}).hide();
                $('.dinner-container').velocity("fadeOut");
            });
        },

        markAsFault: function (time) {
            var that = this;
            var time_id = time.get("_id");
            var data_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAB4CAMAAAAOusbgAAAAA1BMVEX/4wBssakYAAAAJUlEQVRo3u3BMQEAAADCoPVPbQlPoAAAAAAAAAAAAAAAAAAAPgY4uAABqfMnWwAAAABJRU5ErkJggg==);"
            var injection = {};
            time.save({"end": time.get("end"), "photoEnd": data_uri, "fault": true});
            var currentBg = $(".vis-item.vis-background.work.id" + time_id).css('background-image');
            injection[".vis-item.vis-background.work.id" + time_id] = {
                "background-image": currentBg + ', url(' + data_uri + ')'
            };
            $.injectCSS(injection);
            $('.overlay').velocity({opacity: 0}).hide();
            $('.dinner-container').velocity("fadeOut");
        },

        showCameraDialog: function (params) {
            this.ui.webcamName.html(params.name);
            this.ui.webcamAction.html(params.action);
            this.ui.webcamTime.val(params.time);

            $('.overlay').show().velocity({opacity: 0.8});
            $('.dinner-container').velocity("fadeIn");
            webcam.set({
                width: 320,
                height: 240,

                dest_width: 160,
                dest_height: 120,

                crop_width: 120,
                crop_height: 120,

                image_format: 'jpeg',
                jpeg_quality: 90
            });
            webcam.attach('.camera-view');
        },


        cancelButtonClick: function () {
            $('.overlay').velocity({opacity: 0}).hide();
            $('.dinner-container').velocity("fadeOut");
        }

    });
});