  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.
  //model是框架中的基本数据对象，代表数据库中表的一行

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  /*
  *Model的构造函数
  **/
  var Model = Backbone.Model = function(attributes, options) {
    //考虑没有传入参数的情况
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId('c');
    this.attributes = {};
    //对传入的参数进行处理
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
    this.set(attrs, options);
    this.changed = {};
    //执行初始化函数
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  /*
  *扩展Model的prototype方法
  **/
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    //是一个属性的哈希表，用来表示那些当前值和以前的值不同的属性
    changed: null,

    // The value returned during the last failed validation.
    //最后一次验证错误时，返回的值
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    //JSON数据的id属性的默认值为id
    idAttribute: 'id',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    /*
    *初始化函数
    *默认为空函数，可以用自己的初始化方法覆盖它
    **/
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    /*
    *返回model的attribute对象的copy
    **/
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    /*
    *同步方法
    **/
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    /*
    *获取一个属性的值
    **/
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    /*
    *对属性值进行escape转换
    **/
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    /*
    *判断是否含有某个属性
    **/
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    /*
    *是model的核心方法，会触发change
    *这个方法会更新数据，并且通知需要知道数据变化的对象
    **/
    set: function(key, val, options) {
      var attr, attrs, unset, changes, silent, changing, prev, current;
      //key为空的情况下，返回
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      //如果第一个参数是个对象，则赋值给attrs
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      //执行验证函数
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      //缓存一些常用属性，方便调用
      unset           = options.unset;
      silent          = options.silent;
      changes         = [];
      changing        = this._changing;
      this._changing  = true;

      //判断是否有数据正在改变
      //如果没有，保存一份当前的属性和值，并且把changed设置为{}
      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }
      //缓存当前的属性和以前的属性，方便调用
      current = this.attributes, prev = this._previousAttributes;

      // Check for changes of `id`.
      //判断是否需要id属性
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // For each `set` attribute, update or delete the current value.
      //分别处理attrs的属性
      for (attr in attrs) {
        val = attrs[attr];
        //attr的值和当前的值不同，则把attr属性放入changes[]
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        //attr的值和上一次的值不同，把attr的值保存到changed的类别
        //如果和上一次的值相同，则在changed的对象中删除这个属性
        if (!_.isEqual(prev[attr], val)) {
          this.changed[attr] = val;
        } else {
          delete this.changed[attr];
        }
        //根据unset属性，判断是否需要修改current对象相对应的属性
        unset ? delete current[attr] : current[attr] = val;
      }

      // Trigger all relevant attribute changes.
      //触发所有相关的属性改变
      if (!silent) {
        //如果changes数组不为空，保存options
        if (changes.length) this._pending = options;
        //触发changes数组中的所有属性
        for (var i = 0, length = changes.length; i < length; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    /*
    *删除model中的一个属性，同时触发change事件
    *如果这个属性不存在的情况下，是一个空操作
    **/
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    /*
    *清空数据model的所有属性，触发change事件
    **/
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    /*
    *判断数据模式是否改变过了
    *如果传入一个属性名称，则判断这个属性是否改名
    **/
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    /*
    *返回所有的changed属性
    *diff是一个属性对象
    *如果diff为空，对所有的changed属性
    **/
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var val, changed = false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      for (var attr in diff) {
        if (_.isEqual(old[attr], (val = diff[attr]))) continue;
        (changed || (changed = {}))[attr] = val;
      }
      return changed;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    /*
    *返回属性的上一个值
    **/
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    /*
    *返回model数据对象的在change事件之前的属性
    **/
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server. If the server's representation of the
    // model differs from its current attributes, they will be overridden,
    // triggering a `"change"` event.
    /*
    *向服务端请求数据，如果数据的值不同于当前是值，触发change事件
    **/
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      //设置请求的回调函数
      options.success = function(resp) {
        if (!model.set(model.parse(resp, options), options)) return false;
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      var attrs, method, xhr, attributes = this.attributes;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true}, options);

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      //如果wait===false，直接执行set方法
      if (attrs && !options.wait) {
        if (!this.set(attrs, options)) return false;
      } else {
        if (!this._validate(attrs, options)) return false;
      }

      // Set temporary attributes if `{wait: true}`.
      if (attrs && options.wait) {
        this.attributes = _.extend({}, attributes, attrs);
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = model.parse(resp, options);
        if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
        if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
          return false;
        }
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch' && !options.attrs) options.attrs = attrs;
      xhr = this.sync(method, this, options);

      // Restore attributes.
      if (attrs && options.wait) this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    /*
    *销毁一个数据model
    **/
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;

      var destroy = function() {
        model.stopListening();
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (options.wait || model.isNew()) destroy();
        if (success) success(model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      //如果这个model没有传回server，则直接回调函数
      if (this.isNew()) {
        options.success();
        return false;
      }
      wrapError(this, options);

      //服务器删除这个model
      var xhr = this.sync('delete', this, options);
      if (!options.wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    /*
    *
    **/
    url: function() {
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base;
      //url最后如果不是/的时候，加上/，在加上model的id属性
      return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(this.id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    /*
    *clone一个当前的model
    *通过实例化构造函数
    **/
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    /*
    *判断一个model是否是new(即未保存到server)
    *如果保存到server后，会返回一个_id
    **/
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    /*
    *参数是否经过验证
    **/
    isValid: function(options) {
      return this._validate({}, _.extend(options || {}, { validate: true }));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    /*
    *验证attrs和options
    **/
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model.
  /*
  *吧underscore的这些方法绑定到Model的prototype上
  **/
  var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit', 'chain'];

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  _.each(modelMethods, function(method) {
    if (!_[method]) return;
    Model.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.attributes);
      return _[method].apply(_, args);
    };
  });