/**
 * productGrid helpers
 */

/**
 * loadMoreProducts
 * @summary whenever #productScrollLimitLoader becomes visible, retrieve more results
 * this basically runs this:
 * Session.set('productScrollLimit', Session.get('productScrollLimit') + ITEMS_INCREMENT);
 * @return {undefined}
 */
function loadMoreProducts() {
  let threshold;
  let target = $("#productScrollLimitLoader");
  let scrollContainer = $("#reactionAppContainer");

  if (scrollContainer.length === 0) {
    scrollContainer = $(window);
  }

  if (target.length) {
    threshold = scrollContainer.scrollTop() + scrollContainer.height() - target.height();

    if (target.offset().top < threshold) {
      if (!target.data("visible")) {
        target.data("productScrollLimit", true);
        Session.set("productScrollLimit", Session.get("productScrollLimit") + ITEMS_INCREMENT || 24);
      }
    } else {
      if (target.data("visible")) {
        target.data("visible", false);
      }
    }
  }
}

Template.productGrid.onCreated(function () {
  Session.set("productGrid/selectedProducts", []);
  // Update product subscription
  this.autorun(() => {
    const slug = ReactionRouter.getParam("slug");
    const { Tags } = ReactionCore.Collections;
    const tag = Tags.findOne({ slug: slug }) || Tags.findOne(slug);
    let tags = {}; // this could be shop default implementation needed
    if (tag) {
      tags = {tags: [tag._id]};
    }
    const queryParams = Object.assign({}, tags, ReactionRouter.current().queryParams);
    Meteor.subscribe("Products", Session.get("productScrollLimit"), queryParams);
  });

  this.autorun(() => {
    const isActionViewOpen = ReactionCore.isActionViewOpen();
    if (isActionViewOpen === false) {
      Session.set("productGrid/selectedProducts", []);
    }
  });
});

Template.productGrid.onRendered(() => {
  // run the above func every time the user scrolls
  $("#reactionAppContainer").on("scroll", loadMoreProducts);
  $(window).on("scroll", loadMoreProducts);
});

Template.productGrid.events({
  "click [data-event-action=loadMoreProducts]": (event) => {
    event.preventDefault();
    loadMoreProducts();
  },
  "change input[name=selectProduct]": (event) => {
    let selectedProducts = Session.get("productGrid/selectedProducts");

    if (event.target.checked) {
      selectedProducts.push(event.target.value);
    } else {
      selectedProducts = _.without(selectedProducts, event.target.value);
    }

    Session.set("productGrid/selectedProducts", _.uniq(selectedProducts));

    let products = Template.instance().products;
    let filteredProducts = _.filter(products, (product) => {
      return _.contains(selectedProducts, product._id);
    });

    ReactionCore.showActionView({
      label: "Edit Product",
      template: "productSettings",
      type: "product",
      data: {
        products: filteredProducts
      }
    });
  }
});

Template.productGrid.helpers({
  loadMoreProducts: function () {
    return ReactionCore.Collections.Products.find().count() >= Session.get("productScrollLimit");
  },
  products: function () {
    /*
     * take natural sort, sorting by updatedAt
     * then resort using positions[currentTag].position for this tag
     * retaining natural sort of untouched items
     */

    // we are caching `currentTag` or if we are not inside tag route, we will
    // use shop name as `base` name for `positions` object
    const currentTag = ReactionProduct.getTag();

    // function to compare and sort position
    function compare(a, b) {
      // we need to check that fields exists
      // todo we could remove part of this checks of `positions` and `base`
      // settings will be required fields
      if (a.positions && a.positions[currentTag] &&
        b.positions && b.positions[currentTag]) {
        if (a.positions[currentTag].position === b.positions[currentTag].position) {
          const x = a.positions[currentTag].updatedAt;
          const y = b.positions[currentTag].updatedAt;

          if (x > y) {
            return -1;
          } else if (x < y) {
            return 1;
          }

          return 0;
        }
        return a.positions[currentTag].position - b.positions[currentTag].position;
      } // if some of them not exist, we need to comprare products `updatedAt`
      const x = a.updatedAt;
      const y = b.updatedAt;

      if (x > y) {
        return -1;
      } else if (x < y) {
        return 1;
      }
      return 0;
    }

    let gridProducts = ReactionCore.Collections.Products.find({}).fetch();
    const products = gridProducts.sort(compare);
    Template.instance().products = products;
    return products;
  }
});