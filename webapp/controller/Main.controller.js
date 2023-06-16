/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"jquery.sap.global",
	"./Email.controller",
	"./Print.controller",
	"./utils/ModelUtils",
	"./utils/AdvancedParameters",
	"./utils/Mappings",
	"./utils/UrlParametersParser",
	"sap/ui/core/ValueState",
	"fin/ar/correspondence/create/v2/controller/BaseController",
	"sap/ui/generic/app/navigation/service/NavigationHandler",
	"sap/ui/generic/app/navigation/service/SelectionVariant",
	"sap/ui/generic/app/navigation/service/NavType",
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/ui/core/MessageType",
	"sap/ui/core/format/DateFormat",
	"sap/m/ObjectListItem",
	"sap/m/ListType",
	"sap/m/ListMode",
	"sap/m/MessageBox",
	"sap/m/Link",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/ObjectStatus"
], function(jQuery, EmailController, PrintController, ModelUtils, AdvancedParameters, Mappings, UrlParameterParser, ValueState, BaseController, // eslint-disable-line max-params
			NavigationHandler, SelectionVariant, NavType, JSONModel, Device, MessagePopover, MessageItem, MessageType,
			DateFormat, ObjectListItem, ListType, ListMode, MessageBox, Link, Filter, FilterOperator, ObjectStatus) {
	"use strict";


	var oDateFormat = DateFormat.getDateInstance({
		pattern: "yyyyMMdd",
		UTC: true
	});

	var mAccountType = Mappings.AccountTypes;
	var mAdvancedParameterEvents = Mappings.AdvancedParameterEvents;
	var mConfigurationChannels = Mappings.ConfigurationChannels;
	var mControllers = Mappings.Controllers;
	var mCorrespondenceOutputProperties = Mappings.CorrespondenceOutputProperties;
	var mCorrItemsProperties = Mappings.CorrItemsProperties;
	var mDialogTypes = Mappings.DialogTypes;
	var mEmailTypes = Mappings.EmailTypes;
	var mEntityTypes = Mappings.EntityTypes;
	var mEntitySets = Mappings.EntitySets;
	var mFieldLabels = Mappings.FieldLabels;
	var mFunctionImports = Mappings.FunctionImports;
	var mGlobalSettingsProperties = Mappings.GlobalSettingsProperties;
	var mIds = Mappings.Ids;
	var mInputFields = Mappings.InputFields;
	var mMasterPageButtons = Mappings.MasterPageButtons;
	var mMessagePopoverKeys = Mappings.MessagePopoverKeys;
	var mMessagePopoverGroups = Mappings.MessagePopoverGroups;
	var mModelNames = Mappings.ModelNames;
	var mModelPropertyTypes = Mappings.ModelPropertyTypes;
	var mNonValueBindings = Mappings.NonValueBindings;
	var mPrinters = Mappings.Printers;
	var mRegularPatterns = Mappings.RegularPatterns;
	var mServices = Mappings.Services;
	var mStateProperties = Mappings.StateProperties;
	var mUrlParameters = Mappings.UrlParameters;
	var mExternalActions = Mappings.ExternalActions;
	var mDisplaySettings = Mappings.DisplaySettings;


	return BaseController.extend("fin.ar.correspondence.create.v2.controller.Main", {
		constructor: function() {
			BaseController.apply(this, arguments);

			/**
			 * JSON model for correspondence items
			 *
			 * @type {Array}
			 */
			this.oCorrItemsModel = [];

			/**
			 * Display JSON model. Mainly determined by data from selected correspondence.
			 */
			this.oDisplayModel = {};

			/**
			 * State JSON model, holds information about application state.
			 */
			this.oStateModel = {};

			/**
			 * State JSON model, holds current messages in MessagePopover.
			 */
			this.oMessagePopoverModel = {};

			/**
			 * Controls overview for inactive correspondence items and buttons visibility.
			 */
			this.oGlobalSettingsModel = {};

			/**
			 * Counter used as id for correspondence items
			 *
			 * @type {number}
			 */
			this.iCorrIndex = 1;
		},

		// ===========================================================
		// lifecycle methods
		// ===========================================================
		onInit: function() {
			this.oModel = this.getOwnerComponent().getModel();
			this.oModel.setDefaultBindingMode("TwoWay");

			this.oCtrlCorrespondence = this.byId(mIds.Event);
			this.oPdf = this.byId(mIds.Pdf);
			this.oList = this.byId(mIds.CorrItemsList);
			this.oPagingButton = this.byId(mIds.PagingButton);
			this.oAdvancedForm = this.byId(mIds.AdvancedForm);
			this.oActiveCorrListItem = null;
			this.oMessagePopoverButton = this.byId(mIds.MessagePopoverButton);
			this.oNavigationHandler = new NavigationHandler(this);

			this._initModels();
			this._initErrorHandlers();

			// message handler
			this._errorHandler = this.getOwnerComponent().getErrorHandler();

			this.oModel.metadataLoaded().then(this.initContexts.bind(this));

			// show controls after they are loaded
			this.oModel.getMetaModel().loaded().then(function() {
				this._resetCorrItemsModelVisibility(this.getActiveBindingContext());
				this.setSmartFieldsMaxLength();
			}.bind(this));

			this.setInitialFocus();

			var oRouter = this.getRouter();
			oRouter.getRoute("main").attachPatternMatched(this._onEmptyMasterMatched, this);
			oRouter.getRoute("object").attachPatternMatched(this._onPreviewMatched, this);
		},

		initContexts: function() {
			// oData Model for default input
			var oView = this.getView();
			var oContext = this.oModel.createEntry("/" + mEntitySets.CorrOutputSet);
			oView.setBindingContext(oContext);
			oView.setModel(this.oModel);

			this.oPrintContext = this.oModel.createEntry("/" + mEntitySets.PrintSet);

			this.oEmailFormController = new EmailController("form");

			var aControls = sap.ui.xmlfragment(this.oEmailFormController.Id, "fin.ar.correspondence.create.v2.view.EmailForm", this.oEmailFormController);
			var oInvisibleLabel = aControls[0];
			var oEmailFormFragment = aControls[1];

			this.oEmailFormController.initDialog({
				dialog: oEmailFormFragment,
				model: this.oModel,
				controller: this
			});

			oView.addDependent(oInvisibleLabel);
			oView.addDependent(oEmailFormFragment);
			oView.byId(mIds.IconTabBarFilterEmail).addContent(oEmailFormFragment);

			oEmailFormFragment.bindProperty("visible", {
				path: "corrItems>State/IsEmailFormVisible"
			});

			this.setGlobalChannelsConfiguration();
			this._initParameters();
		},

		setInitialFocus: function() {
			var that = this;
			if (!this._isMobileDevice()) {
				var oCompanyCodeField = this.byId(mIds.CompanyCode);
				var oDelegate = {
					onAfterRendering: function(oEvent) {
						that.byId(mIds.CompanyCode).focus();
						oCompanyCodeField.removeEventDelegate(oDelegate);
					}
				};
				oCompanyCodeField.addEventDelegate(oDelegate);
			}
		},

		isAnyDialogOpen: function() {
			var bEmailOpen = this.oEmailDialog && this.oEmailDialog.isOpen();
			var bPrintOpen = this.oPrintDialog && this.oPrintDialog.isOpen();
			var bPopoverOpen = this._oMessagePopover && this._oMessagePopover.isOpen();

			return bEmailOpen || bPrintOpen || bPopoverOpen;
		},

		setSmartFieldsMaxLength: function() {
			var fnSetMaxLength = function(iMaxLength, oEvent) {
				try {
					var oControl = oEvent.getSource().getInnerControls()[0];
					oControl.setMaxLength(iMaxLength);
				} catch (e) {
					jQuery.sap.log.error("Could not set maxLength for SmartField.");
				}
			};

			var oMaxLengths = this.getMaxLengths();

			this.byId(mIds.CompanyCode).attachInitialise(fnSetMaxLength.bind(this, oMaxLengths.companyCode));
			this.byId(mIds.CustomerNumber).attachInitialise(fnSetMaxLength.bind(this, oMaxLengths.customerNumber));
			this.byId(mIds.VendorNumber).attachInitialise(fnSetMaxLength.bind(this, oMaxLengths.vendorNumber));
		},

		getMaxLengths: function() {
			var sPath = mServices.Correspondence + "." + mEntityTypes.CorrOutput;
			var aProperties = this.oModel.getMetaModel().getODataEntityType(sPath).property;

			var oMaxLength = {
				companyCode: 0,
				customerNumber: 0,
				vendorNumber: 0
			};

			aProperties.forEach(function(oProp) {
				if (!oProp.maxLength) {
					return;
				}

				if (oProp.name === mCorrespondenceOutputProperties.CompanyCode) {
					oMaxLength.companyCode = Number(oProp.maxLength);
				} else if (oProp.name === mCorrespondenceOutputProperties.CustomerNumber) {
					oMaxLength.customerNumber = Number(oProp.maxLength);
				} else if (oProp.name === mCorrespondenceOutputProperties.VendorNumber) {
					oMaxLength.vendorNumber = Number(oProp.maxLength);
				}
			});

			return oMaxLength;
		},

		onAfterRendering: function() {
			//iframe in IE overlaps everything (ignores z-index of dialogs)
			if (this._isMicrosoftBrowser()) {
				var sPageId = this.getView().byId(mIds.Page).getId();

				jQuery("#" + sPageId + "-shareButton").click(this._hidePdfVisibility.bind(this));
				jQuery("header").click(this._hidePdfVisibility.bind(this));
			}

			if (!this._isMobileDevice()) {
				this._initPdf();
			}
		},

		/**
		 * Init all "supporting" models
		 *
		 * @private
		 */
		_initModels: function() {
			var oView = this.getView();
			var oDisplayData = ModelUtils.getDefaultDisplayModelData(this.isShareInJamActive());
			this.oDisplayModel = new JSONModel(oDisplayData);
			oView.setModel(this.oDisplayModel, mModelNames.Display);

			this.initMessagePopover();

			this.processDisplayCorrespondenceHistoryAvailable();
			var oStateData = ModelUtils.getDefaultStateModelData();
			this.oStateModel = new JSONModel(oStateData);
			oView.setModel(this.oStateModel, mModelNames.State);

			this.oCorrItemsModel = new JSONModel({});
			oView.setModel(this.oCorrItemsModel, mModelNames.CorrItems);
			this.createNewCorrItem();

			var oGlobalSettingsData = ModelUtils.getDefaultGlobalSettings();
			this.oGlobalSettingsModel = new JSONModel(oGlobalSettingsData);
			oView.setModel(this.oGlobalSettingsModel, mModelNames.GlobalSettings);
		},

		setGlobalChannelsConfiguration: function() {
			var that = this;

			this.oModel.read("/" + mEntitySets.ConfigurationSet, {
				success: function(oData, oResponse) {
					var aChannels = oData.results;
					var oGlobalSettings = that.oGlobalSettingsModel.getData();

					aChannels.forEach(function(oChannel) {
						var aProperties = [];

						switch (oChannel.Name) {
							case mConfigurationChannels.Email:
								if (oGlobalSettings[mGlobalSettingsProperties.EmailAction]) {
									aProperties.push(mGlobalSettingsProperties.EmailAction);
								}
								if (oGlobalSettings[mGlobalSettingsProperties.EmailPreview]) {
									aProperties.push(mGlobalSettingsProperties.EmailPreview);
								}
								if (oGlobalSettings[mGlobalSettingsProperties.MassEmailAction]) {
									aProperties.push(mGlobalSettingsProperties.MassEmailAction);
								}
								break;
							case mConfigurationChannels.Print:
								if (oGlobalSettings[mGlobalSettingsProperties.MassPrintAction]) {
									aProperties.push(mGlobalSettingsProperties.MassPrintAction);
								}
								if (oGlobalSettings[mGlobalSettingsProperties.PrintAction]) {
									aProperties.push(mGlobalSettingsProperties.PrintAction);
								}
								break;
							default:
								break;
						}
						that._setModelProperties(that.oGlobalSettingsModel, aProperties, !!oChannel.Value);
					});
				},
				error: function(oData, oResponse) {
				}
			});
		},

		isShareInJamActive: function() {
			return this.getOwnerComponent().getModel("FLP").getProperty("/isShareInJamActive");
		},

		messageItemFactory: function(sControlId, oMessagePopoverContext) {
			var that = this;
			var oItemContext;
			var oItem;

			for (var i = 0, aItems = this.oList.getItems(); i < aItems.length; i++) {
				oItem = aItems[i];
				oItemContext = oItem.getBindingContext(mModelNames.CorrItems);

				if (oItemContext.getProperty(mModelPropertyTypes.Id) === oMessagePopoverContext.getProperty(mModelPropertyTypes.Id)) {
					break;
				}
			}

			var sSubtitle = this._getItemTitle(oItemContext) + " - " + oMessagePopoverContext.getProperty("subtitle");

			return new MessageItem({
				title: oMessagePopoverContext.getProperty("title"),
				subtitle: sSubtitle,
				description: sSubtitle,
				key: oMessagePopoverContext.getProperty("key"),
				link: new Link({
					text: this.translateText("SHOW_INCORRECT_ITEM"),
					press: function() {
						if (!oItemContext.getProperty(mCorrItemsProperties.IsActive)) {
							that.switchToItem(oItem);

						}

						var sGroup = oMessagePopoverContext.getProperty("group");
						if (sGroup === mMessagePopoverGroups.Email) {
							that.setActiveTab(mIds.IconTabBarFilterEmail);
						}
					}
				})
			});
		},

		initMessagePopover: function() {
			this._oMessagePopover = new MessagePopover({
				items: {
					path: "/messages",
					factory: this.messageItemFactory.bind(this)
				}
			});

			this.oMessagePopoverModel = new JSONModel();
			this.oMessagePopoverModel.setData({
				messages: []
			});
			this._oMessagePopover.setModel(this.oMessagePopoverModel);

			this.getView().setModel(this.oMessagePopoverModel, mModelNames.Popover);
			this.byId(mIds.MessagePopoverButton).addDependent(this._oMessagePopover);
		},
		
		_processAccountNumberChanged: function(oContext) {
				var sCustomerNumber = this.getCorrItemsBasicField(mCorrItemsProperties.CustomerNumber, oContext);
				if (sCustomerNumber) {
					this._accountNumberChanged(sCustomerNumber, mInputFields.CustomerNumber, function() {
						this._setDataProperty(mInputFields.CustomerNumber, "");
					}.bind(this));
				}

				var sVendorNumber = this.getCorrItemsBasicField(mCorrItemsProperties.VendorNumber, oContext);
				if (sVendorNumber) {
					this._accountNumberChanged(sVendorNumber, mInputFields.VendorNumber, function() {
						this._setDataProperty(mInputFields.VendorNumber, "");
					}.bind(this));
				}
		},

		/* =========================================================== */
		/* event handlers
		 /* =========================================================== */

		onCompanyChanged: function(oEvent) {
			// send for new data
			var sCompanyCode = oEvent.getParameter("value");
			var oContext = this.getActiveBindingContext();

			if (this.companyCodeChangedAtLeastOnce) {
				// reset current changes only after second change of company code,
				// because we want the supplier and customer from default parameters
				// to stay there
				this._resetObject(oContext);
			} else {
				this.companyCodeChangedAtLeastOnce = true;
				this._processAccountNumberChanged(oContext);

			}
			this.setCorrItemsModelProperty(mModelPropertyTypes.SelectedCorrespondence, null);
			this._resetCorrItemsModelVisibility(oContext);
			this.setCorrItemsEditableField(mCorrItemsProperties.CorrespondenceType, false, oContext);

			// oData model doesn't propagate empty value, if the value has required property
			if (!sCompanyCode) {
				this._setDataProperty(mCorrItemsProperties.CompanyCode, sCompanyCode);
			}

			this.setCorrItemsBusyField(mCorrItemsProperties.CompanyCode, true, oContext);
			this.validateCompanyCode(sCompanyCode, oContext);

			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateSenderAddress, true, oContext);
			this.setCorrItemsDialogField(mCorrItemsProperties.InvalidateDialog, true, oContext);
			this.onInputChanged();
		},

		onMenuOptionPressedSaveTile: function() {
			this._storeCurrentAppState();
		},

		onEmailPressed: function() {
			this.initializeController(mControllers.Email);

			var oOptions = {
				controller: this.oEmailController,
				dialog: this.oEmailDialog,
				dialogType: mDialogTypes.Email
			};

			this._openDialog(oOptions);
		},

		onDownloadXMLPressed: function(){
			var oContext = this.getActiveBindingContext();
			if (this._validateCorrespondenceItemInput(oContext)) {
				this.oModel.create("/" + mEntitySets.CorrOutputSet,
					this.getInputData(oContext),
					{
						success: function(oData) {
							var path = this.getModel().sServiceUrl + "/" +
								this.oModel.createKey(mEntitySets.CorrOutputSet, {ApplicationObjectId: oData.ApplicationObjectId}) +
								"/XML/$value/";
							sap.m.URLHelper.redirect(path, true);
						}.bind(this)
					}
				);
			}
		},

		initializeController: function(sController) {
			switch (sController) {
				case mControllers.Email:
					if (!this.oEmailController) {
						this.oEmailController = new EmailController();
						this.oEmailDialog = this._initDialog(this.oEmailController, "fin.ar.correspondence.create.v2.view.Email");
					}
					break;
				case mControllers.Print:
					if (!this.oPrintController) {
						this.oPrintController = new PrintController();
						this.oPrintDialog = this._initDialog(this.oPrintController, "fin.ar.correspondence.create.v2.view.Print");
						this.oPrintDialog.setBindingContext(this.oPrintContext);
					}
					break;
				default:
					break;
			}
		},

		onMassEmailPressed: function() {
			var that = this;

			if (!this._isMultiSelectMode()) {
				this.onEmailPressed();
				return;
			}

			var aCorrItems = this.getSelectedCorrItems();
			var aEmailDisabled = [];
			var aEmailEnabled = [];

			// input needs to be validated for every selected item, because for example correspondence type
			// doesnt have to be filled in yet and so we dont know the email channel type yet thus the item wont be added to aEmailEnabled
			if (!this._validateInput(aCorrItems)) {
				return;
			}

			aCorrItems.forEach(function(oItem) {
				var oContext = oItem.getBindingContext(mModelNames.CorrItems);

				if (this.isEmailEnabled(oContext)) {
					aEmailEnabled.push(oItem);
				} else {
					aEmailDisabled.push(oItem);
				}

			}, this);

			this.initializeController(mControllers.Email);

			this.setBusy();

			this.validateEmails(aEmailEnabled).then(function(bValid) {
				that.setNotBusy();

				if (bValid) {
					var sDescription;
					if (aEmailDisabled.length > 0) {
						sDescription = that.translateText("MULTIPLE_EMAIL_OMITTED", [aEmailEnabled.length, aEmailDisabled.length]);
					} else {
						sDescription = that.translateText("MULTIPLE_EMAIL", [aEmailEnabled.length]);
					}
					that.oEmailController.showMassEmailDialog(sDescription, aEmailEnabled);
				}
			}, function() {
				that.setNotBusy();
			});
		},

		validateEmails: function(aCorrItems) {
			var that = this;
			var aPromises = [];

			aCorrItems.forEach(function(oItem) {
				var oContext = oItem.getBindingContext(mModelNames.CorrItems);

				aPromises.push(
					// setData needs to be called before validation, so we didn't loose the error states on email tab/dialog load (causes reset of the email model)
					this._loadEmailPreviewTab(oContext).then(function() {
						return that.oEmailController._validate(oContext);
					})
				);

			}, this);

			return Promise.all(aPromises).then(function(aValids) {
				return aValids.reduce(function(bResult, bValid) {
					return bResult && bValid;
				}, true);
			});
		},

		isEmailEnabled: function(oContext) {
			var bEnabled = !!this._getModelProperty(this.oGlobalSettingsModel, mGlobalSettingsProperties.MassEmailAction);
			return bEnabled && !!this.getCorrItemsModelProperty(mModelPropertyTypes.EmailType, oContext);
		},

		isPrintEnabled: function(oContext) {
			var bEnabled = !!this._getModelProperty(this.oGlobalSettingsModel, mGlobalSettingsProperties.MassPrintAction);
			return bEnabled && !!this.getCorrItemsModelProperty(mModelPropertyTypes.PrintType, oContext);
		},

		onPrintPressed: function() {
			this.initializeController(mControllers.Print);

			var oOptions = {
				controller: this.oPrintController,
				dialog: this.oPrintDialog,
				dialogType: mDialogTypes.Print,
				printType: this.getCorrItemsModelProperty(mModelPropertyTypes.PrintType)
			};

			this._openDialog(oOptions);
		},

		onMassPrintPressed: function() {
			if (!this._isMultiSelectMode()) {
				this.onPrintPressed();
				return;
			}

			var aCorrItems = this.getSelectedCorrItems();
			var aPrintDisabled = [];
			var aPrintEnabled = [];

			if (!this._validateInput(aCorrItems)) {
				return;
			}

			aCorrItems.forEach(function(oItem) {
				var oContext = oItem.getBindingContext(mModelNames.CorrItems);

				if (this.isPrintEnabled(oContext)) {
					aPrintEnabled.push(oItem);
				} else {
					aPrintDisabled.push(oItem);
				}

			}, this);

			this.initializeController(mControllers.Print);

			var sDescription;
			if (aPrintDisabled.length > 0) {
				sDescription = this.translateText("MULTIPLE_PRINT_OMITTED", [aPrintEnabled.length, aPrintDisabled.length]);
			} else {
				sDescription = this.translateText("MULTIPLE_PRINT", [aPrintEnabled.length]);
			}

			var sDialogPrintType = mPrinters.PrintQueue;

			// we want to preload default printer, but active correspondence doesn't have to be selected
			// so we take a first one or one with PrintQueueSpool as a context for loading default printer
			var oLoadDefaultsContext;

			if (aPrintEnabled.length && aPrintEnabled.length > 0) {
				oLoadDefaultsContext = aPrintEnabled[0].getBindingContext(mModelNames.CorrItems);
			}

			aPrintEnabled.forEach(function(oItem) {
				var oContext = oItem.getBindingContext(mModelNames.CorrItems);
				var sPrinType = this.getCorrItemsModelProperty(mModelPropertyTypes.PrintType, oContext);

				// if some correspondences support print queue and print queue spool, spool is used because it is a subset
				// of print queue printers
				if (sPrinType === mPrinters.PrintQueueSpool) {
					sDialogPrintType = sPrinType;
					oLoadDefaultsContext = oItem.getBindingContext(mModelNames.CorrItems);
				}
			}, this);

			var oOptions = {
				printType: sDialogPrintType,
				text: sDescription,
				data: aPrintEnabled,
				controller: this.oPrintController,
				dialog: this.oPrintDialog,
				dialogType: mDialogTypes.Print
			};

			this._openDialog(oOptions, true, oLoadDefaultsContext);

		},

		onDisplayHistoryPressed: function() {
			var that = this;
			var sSemanticObject = mExternalActions.DCHSemanticObject;
			var sAction = mExternalActions.DCHAction;
			var oInput;
			var oArgs = {};
			var aCorrItems = this.getSelectedCorrItems();

			if (!this._validateInput(aCorrItems, true)) {
				return;
			}

			aCorrItems.forEach(function(oCorrItem) {
				oInput = that.getInputData(oCorrItem.getBindingContext(mModelNames.CorrItems));

				delete oInput.OutputParams;

				Object.keys(oInput).forEach(function(sKey) {
					var vValue = oInput[sKey];
					var sOutKey = sKey;

					if (sKey === mCorrItemsProperties.CustomerNumber) {
						sOutKey = mUrlParameters.Customer;
						oArgs[mCorrItemsProperties.AccountType] = mAccountType.Customer;
					} else if (sKey === mCorrItemsProperties.VendorNumber) {
						sOutKey = mUrlParameters.Supplier;
						oArgs[mCorrItemsProperties.AccountType] = mAccountType.Vendor;
					} else if (sKey === mInputFields.Event) {
						sOutKey = mUrlParameters.Correspondence;
					}

					if (typeof vValue === "string" && vValue !== "") {
						if (oArgs[sOutKey] === undefined) {
							oArgs[sOutKey] = [];
						}

						oArgs[sOutKey].push(oInput[sKey]);
					}
				});
			});

			this.oNavigationHandler.navigate(sSemanticObject, sAction, oArgs, this._getCurrentAppState(), this._navigationError.bind(this));
		},

		_navigationError: function(oParams) {
			this._errorHandler.showError(oParams._sErrorCode);
		},

		_checkNavigation: function(sAction, aResultData) {
			var oNavigationData = this._getModelProperty(this.oGlobalSettingsModel, mGlobalSettingsProperties.ReturnCallback);
			var bNavigate = false;

			oNavigationData.ReturnAfterAction.forEach(function(sExternalAction) {
				bNavigate = bNavigate || (sAction === sExternalAction);
			});

			if (bNavigate) {
				this._navigateToExternal(oNavigationData, aResultData);
			}
		},

		_navigateToExternal: function(oNavigationData, aResultData) {
			var oNavigationParameters = {
				params: JSON.stringify({
					CustomData: oNavigationData.CustomData,
					Result: aResultData
				})
			};

			this.oNavigationHandler.navigate(oNavigationData.SemanticObject, oNavigationData.Action,
				oNavigationParameters, this._getCurrentAppState(), this._navigationError.bind(this));
		},


		onTabSelect: function(oEvent) {
			var sActiveTabId = this.getActiveTab();
			if (sActiveTabId === mIds.IconTabBarFilterPdf ||
				sActiveTabId === mIds.IconTabBarFilterEmail) {
				this._processCorrespondence();
			}
		},

		_getType: function(aChannels, mTypes) {
			var sReturnType = "";

			aChannels.forEach(function(oChannel) {
				var sType = oChannel.ChannelName;
				if (mTypes[sType]) {
					sReturnType = mTypes[sType];
				}
			});

			return sReturnType;
		},

		onCorrespondenceChanged: function(oEvent) {
			var oContext = this.getActiveBindingContext();
			this.setCorrItemsModelProperty(mModelPropertyTypes.SelectedCorrespondence, null);
			this._processCorrespondenceChange(oContext);
			this._validateCorrespondenceItemInput(oContext, true);
			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateEmailSubject, true, oContext);
			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateEmailTemplate, true, oContext);
			this.setCorrItemsDialogField(mCorrItemsProperties.InvalidateDialog, true, oContext);
			this.onInputChanged();
		},

		/**
		 * Changes toggle status and generates controls for advanced parameters
		 *
		 */
		onAdvancedParametersToggle: function() {
			var that = this;
			var sVisiblePropertyPath = ModelUtils.getVisiblePropertyPath(mCorrItemsProperties.AdvancedParameters);
			var bNewState = !this.getCorrItemsModelProperty(sVisiblePropertyPath);

			this.setCorrItemsModelProperty(sVisiblePropertyPath, bNewState);

			if (bNewState) {
				this.oAdvancedForm.destroyContent();
				AdvancedParameters.getControls(
					this.getCorrItemsSelectedCorrespondenceField(mCorrItemsProperties.AdvancedParameters),
					this.onAdvancedParameterChange.bind(this),
					this.getModel()
				).forEach(function(oControl) {
					that.oAdvancedForm.addContent(oControl);
				});
			}
		},

		/**
		 * Transfer values from the oData models into local corrItems model for current or given BindingContext of corrItems model
		 *
		 * @param {object} [oContext] BindingContext of corrItems model
		 */
		copyOdataToLocal: function(oContext) {
			var sAccountType = this.getCorrItemsBasicField(mCorrItemsProperties.AccountType, oContext);
			var sCustomerNumber = this.setOdataPropertyToLocal(mInputFields.CustomerNumber, mCorrItemsProperties.CustomerNumber, oContext);
			var sVendorNumber = this.setOdataPropertyToLocal(mInputFields.VendorNumber, mCorrItemsProperties.VendorNumber, oContext);

			var sAccountNumber = "";
			if (sAccountType === mAccountType.Customer) {
				sAccountNumber = sCustomerNumber;
			} else if (sAccountType === mAccountType.Vendor) {
				sAccountNumber = sVendorNumber;
			}

			this.setCorrItemsBasicField(mCorrItemsProperties.AccountNumber, sAccountNumber, oContext);
			this.setOdataPropertyToLocal(mInputFields.CompanyCode, mCorrItemsProperties.CompanyCode, oContext);
			this.setOdataPropertyToLocal(mInputFields.Date1, mCorrItemsProperties.Date1, oContext);
			this.setOdataPropertyToLocal(mInputFields.Date2, mCorrItemsProperties.Date2, oContext);
			this.setOdataPropertyToLocal(mInputFields.DocumentNumber, mCorrItemsProperties.DocumentNumber, oContext);
			this.setOdataPropertyToLocal(mInputFields.FiscalYear, mCorrItemsProperties.FiscalYear, oContext);
		},

		setOdataPropertyToLocal: function(sOdataModelProperty, sCorrItemModelProperty, oContext) {
			var sOdataValue = this._getDataProperty(sOdataModelProperty);
			this.setCorrItemsBasicField(sCorrItemModelProperty, sOdataValue, oContext);

			return sOdataValue;
		},

		/**
		 * Transfer values from the local corrItems model into oData models for current or given BindingContext of corrItems model
		 *
		 * @param {object} [oContext] BindingContext of corrItems model
		 */
		copyLocaltoOData: function(oContext) {
			var sAccountType = this.setLocalPropertyToOdata(mCorrItemsProperties.AccountType, mInputFields.AccountType, oContext);
			var sCustomerNumber = this.setLocalPropertyToOdata(mCorrItemsProperties.CustomerNumber, mInputFields.CustomerNumber, oContext);
			var sVendorNumber = this.setLocalPropertyToOdata(mCorrItemsProperties.VendorNumber, mInputFields.VendorNumber, oContext);
			var sAccountNumber = "";

			if (sAccountType === mAccountType.Customer) {
				sAccountNumber = sCustomerNumber;

			} else if (sAccountType === mAccountType.Vendor) {
				sAccountNumber = sVendorNumber;
			}

			this._setDataProperty(mCorrItemsProperties.AccountNumber, sAccountNumber);
			this.setLocalPropertyToOdata(mCorrItemsProperties.CompanyCode, mInputFields.CompanyCode, oContext);
			this.setLocalPropertyToOdata(mCorrItemsProperties.Date1, mInputFields.Date1, oContext);
			this.setLocalPropertyToOdata(mCorrItemsProperties.Date2, mInputFields.Date2, oContext);
			this.setLocalPropertyToOdata(mCorrItemsProperties.DocumentNumber, mInputFields.DocumentNumber, oContext);
			this.setLocalPropertyToOdata(mCorrItemsProperties.FiscalYear, mInputFields.FiscalYear, oContext);
		},

		setLocalPropertyToOdata: function(sCorrItemModelProperty, sOdataModelProperty, oContext) {
			var sLocalValue = this.getCorrItemsBasicField(sCorrItemModelProperty, oContext);
			this._setDataProperty(sOdataModelProperty, sLocalValue);

			return sLocalValue;
		},

		clearOdataContext: function() {
			var sPath = this.getView().getBindingContext().getPath();

			this.getView().getModel().resetChanges([sPath]);
		},

		setActiveItemBindingContext: function(oContext) {
			var oDetailPage = this.oView.byId(mIds.DetailPage);
			var oMassEmailButton = this.byId(mIds.MassEmail);
			var oMassPrintButton = this.byId(mIds.MassPrint);

			// at some occasions, valueState from new binding context gets propagated to the old bindingContext, even though it shouldn't
			// this is hack to keep the old values in place
			var oOldContext = oDetailPage.getBindingContext(mModelNames.CorrItems);

			if (oOldContext) {
				var sPath = oOldContext.getPath();
				var oOldData = jQuery.extend(true, {}, this.oCorrItemsModel.getProperty(sPath));
			}

			oDetailPage.setBindingContext(oContext, mModelNames.CorrItems);

			if (oOldData && Object.keys(oOldData).length) {
				this.oCorrItemsModel.setProperty(sPath, oOldData);
			}

			oMassEmailButton.setBindingContext(oContext, mModelNames.CorrItems);
			oMassPrintButton.setBindingContext(oContext, mModelNames.CorrItems);
		},

		removeActiveItemBindingContext: function() {
			this.setActiveItemBindingContext(null);
		},

		/** Creates new correspondence item and adds it to the list
		 *
		 * @param {object}[oItemData] if not undefined, new correspondence item will be duplicate based on this context
		 * @return {object} new binding context
		 */
		createNewCorrItem: function(oItemData) {
			var that = this;
			var iIndex = this.iCorrIndex;
			var sPath = "/" + iIndex;
			var oOldBindingContext = this.getActiveBindingContext();
			var oNewBindingContext = this.oCorrItemsModel.createBindingContext(sPath);

			this.iCorrIndex += 1;

			if (oOldBindingContext) {
				this.copyOdataToLocal(oOldBindingContext);
			}

			this.oCtrlCorrespondence.setValue("");

			if (oItemData) {
				oItemData.IsActive = true;
				oItemData.IsSelected = true;
				oItemData.Id = iIndex;
				this.oCorrItemsModel.setProperty(sPath, jQuery.extend(true, {}, oItemData));

			} else {
				var oDefaultData = ModelUtils.getDefaultCorrItemObject(iIndex);
				if (this.oList.getItems().length === 0) {
					oDefaultData.IsActive = true;
				}

				this.oCorrItemsModel.setProperty(sPath, oDefaultData);
			}
			this.setActiveItemBindingContext(oNewBindingContext);

			var oItem = sap.ui.xmlfragment("fin.ar.correspondence.create.v2.view.CorrItem", this);
			oItem.setBindingContext(oNewBindingContext, mModelNames.CorrItems);
			this.oList.addItem(oItem);
			this.oActiveCorrListItem = oItem;

			// background should be only for the active item, not for all the selected items
			var bFocused = false;
			oItem.addEventDelegate({
				onAfterRendering: function(oEvent) {
					var bActive = (that.oActiveCorrListItem === oItem);
					that._setActiveClass(oItem, bActive);

					if (!bFocused) {
						bFocused = true;
						oItem.focus();
					}
				}
			});

			if (oOldBindingContext) {
				this.copyLocaltoOData(oNewBindingContext);
				this.setCorrItemsModelProperty(mCorrItemsProperties.IsActive, false, oOldBindingContext);
			}


			this.oPagingButton.setCount(this.getCorrItemsCount());
			this.oPagingButton.setPosition(this.getCorrItemsCount());
			this.setEnableMassButtons(true);
			this.setEnableSingleButtons(true);
			this._setModelProperty(this.oStateModel, mMasterPageButtons.Preview, true);

			if (this._isMultiSelectMode()) {
				this._setModelProperty(this.oStateModel, mStateProperties.SelectAllVisible, true);
			}

			this.oCorrItemsModel.refresh(true);

			this.setCopyButton();

			this.setActiveTab(mIds.IconTabBarFilterCorrData);

			return oNewBindingContext;
		},

		onAddPressed: function(oEvent) {
			this.createNewCorrItem();
			this.onInputChanged();
		},


		/**
		 * Removes given item/s from correspondence list
		 *
		 * @param {[]|object} vItems item or items for removal
		 */
		removeCorrItems: function(vItems) {
			var aItems = Array.isArray(vItems) ? vItems : [vItems];

			aItems.forEach(function(oItem) {
				var oContext = oItem.getBindingContext(mModelNames.CorrItems);
				var iIndex = oContext.getPath().substring(1);

				if (oItem === this.oActiveCorrListItem) {
					this.onInputChanged();
					this.clearOdataContext();
				}

				this.oList.removeItem(oItem);
				delete this.oCorrItemsModel.getData()[iIndex];
			}, this);

			var iCount = this.getCorrItemsCount();

			if (iCount === 0) {
				this.setEnableSingleButtons(false);
				this._setModelProperty(this.oStateModel, mStateProperties.SelectAllVisible, false);
				this._setModelProperty(this.oStateModel, mMasterPageButtons.Preview, false);
			}

			this.oPagingButton.setCount(this.getCorrItemsCount());

			if (!this.getSelectedCorrItems().length) {
				this.setEnableMassButtons(false);
				this.setEnableSingleButtons(false);
				this.oPagingButton.setCount(1);
				this.oActiveCorrListItem = null;
			}

			this.setCopyButton();

			this.oCorrItemsModel.refresh(true);
		},


		onCopyPressed: function(oEvent) {
			var oItem;
			var oOldBindingContext;
			var oData;

			oItem = (this._isMultiSelectMode()) ? this.getSelectedCorrItems()[0] : this.oActiveCorrListItem;

			oOldBindingContext = oItem.getBindingContext(mModelNames.CorrItems);

			if (oItem === this.oActiveCorrListItem) {
				this.copyOdataToLocal(oOldBindingContext);
			}

			oData = jQuery.extend(true, {}, oOldBindingContext.getProperty());
			oData.Title = null;

			var oContext = this.createNewCorrItem(oData);
			this._resetCorrespondenceStatuses(oContext);
		},

		onDeletePressed: function(oEvent) {
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			var iCount = this.getSelectedCorrItems().length;

			MessageBox.show(
				iCount > 1 ? this.translateText("DELETE_CORR_ITEMS", [iCount]) : this.translateText("DELETE_CORR_ITEM"), {
					title: this.translateText("DELETE_TITLE"),
					icon: MessageBox.Icon.WARNING,
					styleClass: bCompact ? "sapUiSizeCompact" : "",
					actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
					emphasizedAction: MessageBox.Action.DELETE,
					initialFocus: MessageBox.Action.DELETE,
					onClose: this.onDeleteDialogConfirmation.bind(this)
				}
			);
		},

		onDeleteDialogConfirmation: function(oAction) {
			if (oAction === MessageBox.Action.DELETE) {
				var vItems;
				if (this._isMultiSelectMode()) {
					vItems = this.getSelectedCorrItems();
				} else {
					vItems = this.oActiveCorrListItem;
				}

				var oNewItem = this.getNewActiveCorrItem();
				this.removeCorrItems(vItems);
				if (typeof oNewItem !== "undefined") {
					this.switchToItem(oNewItem);
				}
				this.oMessagePopoverModel.setProperty("/messages", []);
			}
		},

		getNewActiveCorrItem: function() {
			var iActiveItemIndex = this.oList.indexOfItem(this.oActiveCorrListItem);
			var aItems = this.oList.getItems();
			var vNewActiveItem;

			if (this._isMultiSelectMode()) {
				vNewActiveItem = this._getNewActiveItemMultiSelect(aItems, iActiveItemIndex);
			} else {
				if (aItems.length === iActiveItemIndex + 1) {
					vNewActiveItem = iActiveItemIndex;
				} else {
					vNewActiveItem = iActiveItemIndex + 1;
				}
			}

			return vNewActiveItem;
		},

		_getNewActiveItemMultiSelect: function(aItems, iActiveItemIndex) {
			var oNewActiveItem = null;

			if (iActiveItemIndex <= 0) {
				return oNewActiveItem;
			}

			for (var i = iActiveItemIndex - 1; i < aItems.length; i++) {
				if (!aItems[i].getSelected()) {
					oNewActiveItem = aItems[i];
					break;
				}
			}

			if (!oNewActiveItem) {
				for (i = iActiveItemIndex - 1; i >= 0; i--) {
					if (!aItems[i].getSelected()) {
						oNewActiveItem = aItems[i];
						break;
					}
				}
			}

			return oNewActiveItem;
		},

		setEnableMassButtons: function(bEnable) {
			this._setModelProperty(this.oStateModel, mMasterPageButtons.Email, bEnable);
			this._setModelProperty(this.oStateModel, mMasterPageButtons.Print, bEnable);
			this._setModelProperty(this.oStateModel, mMasterPageButtons.Delete, bEnable);
		},

		setEnableSingleButtons: function(bEnable) {
			this._setModelProperty(this.oStateModel, mNonValueBindings.EmailButton, bEnable);
			this._setModelProperty(this.oStateModel, mNonValueBindings.PrintButton, bEnable);
			this._setModelProperty(this.oStateModel, mNonValueBindings.PreviewButton, bEnable);
			this._setModelProperty(this.oStateModel, mNonValueBindings.DownloadXMLButton, bEnable);
		},

		/**
		 * In case of MultiSelect mode, returns selected correspondence items
		 * Otherwise returns active item if exists
		 *
		 * @return {[object]} list of selected correspondence items
		 */
		getSelectedCorrItems: function() {
			if (!this._isMultiSelectMode()) {
				if (this._isActiveCorrItem()) {
					return [this.oActiveCorrListItem];
				} else {
					return [];
				}

			} else {
				return this.oList.getItems().filter(function(oItem) {
					return oItem.getVisible() && oItem.getSelected();
				});
			}
		},

		onMultiSelectAction: function() {
			var bMultiSelect = !this._isMultiSelectMode();
			var oListMode = bMultiSelect ? ListMode.MultiSelect : ListMode.None;

			this._setModelProperty(this.oStateModel, mStateProperties.MultiSelect, bMultiSelect);
			this._setModelProperty(this.oStateModel, mStateProperties.ListMode, oListMode);
			this._setModelProperty(this.oStateModel, mStateProperties.SelectAll, bMultiSelect);

			var bSelectAllVisible = (bMultiSelect && this.getCorrItemsCount() > 0);
			this._setModelProperty(this.oStateModel, mStateProperties.SelectAllVisible, bSelectAllVisible);

			this.selectAllCorresppondences(bMultiSelect);
			this.setEnableMassButtons(bMultiSelect && this.getSelectedCorrItems().length > 0 || this._isActiveCorrItem());
			this.setCopyButton();
		},

		onSelectAllAction: function() {
			var bSelected = this._getModelProperty(this.oStateModel, mStateProperties.SelectAll);
			var sTooltip = bSelected ? this.translateText("CLEAR_ALL_TOOLTIP") : this.translateText("SELECT_ALL_TOOLTIP");

			this.getView().byId(mIds.SelectAllButton).setTooltip(sTooltip);
			this.getView().byId(mIds.SelectAllLabelTitle).setText(sTooltip);
			this.selectAllCorresppondences(bSelected);
			this.setCopyButton();
		},

		selectAllCorresppondences: function(bSelect) {
			this.oList.getItems().forEach(function(oItem) {
				oItem.setSelected(bSelect);
				this._setActiveClass(oItem, (oItem === this.oActiveCorrListItem));
			}, this);

			this.setEnableMassButtons(bSelect);
		},

		_shouldDoPreview: function(bForcePreview) {
			return !!bForcePreview || this.getActiveTab() !== mIds.IconTabBarFilterCorrData;
		},

		/**
		 * Switch active item to a given one
		 *
		 * @param {object|number} vItem item object or index of the item in the correspondece list
		 * @param {boolean} [bForcePreview=false] whether to force validation on the item
		 */
		switchToItem: function(vItem, bForcePreview) {
			var iIndex;
			var oItem;

			if (typeof vItem === "object") {
				oItem = vItem;
				iIndex = this.oList.indexOfItem(oItem);
			} else {
				iIndex = vItem - 1;
				oItem = this.oList.getItems()[vItem - 1];
			}

			this.oPagingButton.setCount(this.getCorrItemsCount());
			this.oPagingButton.setPosition(iIndex + 1);

			var oOldBindingContext = this.getActiveBindingContext();
			if (!oItem) {
				return;
			}
			var oNewBindingContext = oItem.getBindingContext(mModelNames.CorrItems);
			this.oActiveCorrListItem = oItem;
			oItem.focus();

			this.setCorrItemsVisibleField(mCorrItemsProperties.AdvancedParameters, false, oNewBindingContext);

			this.setActiveItemBindingContext(oNewBindingContext);
			if (oOldBindingContext) {
				this.copyOdataToLocal(oOldBindingContext);
			}

			this.copyLocaltoOData(oNewBindingContext);
			this.setCorrItemsModelProperty(mCorrItemsProperties.IsActive, false, oOldBindingContext);
			this.setCorrItemsModelProperty(mCorrItemsProperties.IsActive, true, oNewBindingContext);

			this.setCopyButton();

			if (this.oList.getMode() === ListMode.None) {
				this.setEnableMassButtons(true);
				this._setModelProperty(this.oStateModel, mMasterPageButtons.Preview, true);
			}
			this.setEnableSingleButtons(true);

			this._setMassActiveClass();

			if (this._shouldDoPreview(bForcePreview)) {
				this._processCorrespondence();
			}

			// to prevent wrong values staying in some fields
			// e.g. when wrong input in Correspondence field, without refresh, it would be shown in the new item
			this.oCorrItemsModel.refresh(true);
		},

		onListItemPress: function(oEvent) {
			var oItem = oEvent.getParameters().listItem;

			if (this._isMobileDevice()) {
				this.getRouter().navTo("object");
			}

			this.switchToItem(oItem);
		},

		setActiveTab: function(sTabId) {
			var oIconTabBar = this.byId(mIds.IconTabBar);

			// create id does not create new unique id, but instead returns built global id of a control
			var sId = this.createId(sTabId);
			oIconTabBar.setSelectedKey(sId);

			if (sTabId === mIds.IconTabBarFilterEmail) {
				this.onTabSelect();
			}
		},

		getActiveTab: function() {
			var oIconTabBar = this.byId(mIds.IconTabBar);

			return oIconTabBar.getSelectedKey().split("-").slice(-1)[0];
		},

		/**
		 * Enables copy button. In MultiSelect mode if only one item is selected.
		 * In default mode only if there is one active highlighted item.
		 */
		setCopyButton: function() {
			var bOnlyOneSelected = this.getSelectedCorrItems().length === 1;
			var bEnable = (this._isMultiSelectMode()) ? bOnlyOneSelected : this._isActiveCorrItem();

			this._setModelProperty(this.oStateModel, mMasterPageButtons.Copy, bEnable);
		},

		onListItemSelect: function(oEvent) {
			var bSelected = oEvent.getParameter("selected");
			var oItem = oEvent.getParameter("listItem");

			if (!bSelected && oItem === this.oActiveCorrListItem) {
				this._setActiveClass(this.oActiveCorrListItem, true);
			} else if (bSelected && oItem !== this.oActiveCorrListItem) {
				this._setActiveClass(oItem, false);
			}

			this.setCopyButton();
			this.setEnableMassButtons(bSelected || this.getSelectedCorrItems().length > 0);

			var bSelectAll = (this.getSelectedCorrItems().length === this.getCorrItemsCount());
			this._setModelProperty(this.oStateModel, mStateProperties.SelectAll, bSelectAll);
		},

		getCorrItemsCount: function() {
			return Object.keys(this.oCorrItemsModel.getData()).length;
		},

		onPositionChange: function(oEvent) {
			this.switchToItem(oEvent.getParameter("newPosition"));
		},

		/**
		 *
		 * @param {object} oEvent event
		 * @param {boolean} [aCorrItems] Correspondence items that should be processed. Default to active one.
		 */
		onPreviewPressed: function(oEvent, aCorrItems) {
			this._processPreview(aCorrItems);
		},

		onMassPreviewPressed: function(oEvent) {
			this.onPreviewPressed(oEvent, this.oList.getItems());
		},

		onAccountTypeChanged: function(oEvent) {
			var oContext = this.getActiveBindingContext();

			var sSelectedIndex = oEvent.getParameter("selectedIndex");
			this.setCorrItemsVisibleField(mCorrItemsProperties.VendorNumber, (sSelectedIndex === 1), oContext);
			this.setCorrItemsVisibleField(mCorrItemsProperties.CustomerNumber, (sSelectedIndex === 0), oContext);

			var sAccountType = (sSelectedIndex === 0) ? mAccountType.Customer : mAccountType.Vendor;
			this.setCorrItemsBasicField(mCorrItemsProperties.AccountType, sAccountType, oContext);
			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateEmailTo, true, oContext);
			this.setCorrItemsDialogField(mCorrItemsProperties.InvalidateDialog, true, oContext);
			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateSenderAddress, true, oContext);
			this.onInputChanged();
		},

		onInputChanged: function() {
			this.setCorrItemsModelProperty(mCorrItemsProperties.PdfPath, "");
			this._hidePdfAndEmailTabsContent();
			this._resetCorrespondenceStatuses(this.getActiveBindingContext());

			var aKeysToRemove = this.getHiddenFieldKeys();
			aKeysToRemove.push(mMessagePopoverKeys.Emailto);
			aKeysToRemove.push(mMessagePopoverKeys.EmailTemplate);
			this.removePopoverMessages(aKeysToRemove);
		},

		onCustomerNumberChanged: function(oEvent) {
			var sCustomerNumber = oEvent.getParameter("value");
			this._accountNumberChanged(sCustomerNumber, mInputFields.CustomerNumber);
		},

		onVendorNumberChanged: function(oEvent) {
			var sVendorNumber = oEvent.getParameter("value");
			this._accountNumberChanged(sVendorNumber, mInputFields.VendorNumber);
		},

		_accountNumberChanged: function(sAccountNumber, sType, fnCustomHandleWrongAccountNumberCallback) {
			var oContext = this.getActiveBindingContext();

			this.setCorrItemsBusyField(sType, true, oContext);
			/**
			 * When user selects Account number (Customer/Supplier) from value helper with different company code
			 * than which is right now in the model, the change of CompanyCode is not yet propagated
			 * in the model. That's why we have to validate the value after the Company code value is in the model.
			 * That's why we have to use setTimeout with 0 delay, so it is done after actual event loop ends.
			 */
			setTimeout(function() {
				this.copyOdataToLocal(oContext);
				this.validateAccountNumber(sType, sAccountNumber, oContext, fnCustomHandleWrongAccountNumberCallback);
			}.bind(this), 0);

			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateEmailTo, true, oContext);

			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateEmailSubject, true, oContext);
			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateEmailTemplate, true, oContext);
			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateEmailTemplatePreview, true, oContext);
			this.setCorrItemsDialogField(mCorrItemsProperties.InvalidateDialog, true, oContext);
			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateSenderAddress, true, oContext);
			this.onInputChanged();
		},

		validateAccountNumber: function (sType, sAccountNumber, oContext, fnCustomHandleWrongAccountNumberCallback) {
			var sCompanyCode = this.getCorrItemsBasicField(mCorrItemsProperties.CompanyCode, oContext);
			this.serverValidateAccountNumber(sAccountNumber, sCompanyCode, sType).then(function (data) {
					// smartfield reset valueState to None on itself
					// as it have validation on model
					this.removePopoverMessages(sType, oContext);
					if (data.Customer) {
						this.setCorrItemsBasicField(mCorrItemsProperties.CustomerNumber, data.Customer, oContext);
						this.setCorrItemsBasicField(mCorrItemsProperties.CustomerName, data.CustomerName, oContext);
					} else if (data.Supplier) {
						this.setCorrItemsBasicField(mCorrItemsProperties.VendorNumber, data.Supplier, oContext);
						this.setCorrItemsBasicField(mCorrItemsProperties.VendorName, data.SupplierName, oContext);
					}
				}.bind(this),
				function () {
					if (!fnCustomHandleWrongAccountNumberCallback) {
						this._handleWrongAccountNumber(oContext, sType);
					} else {
						fnCustomHandleWrongAccountNumberCallback(oContext, sType);
					}
					if (sType === mInputFields.CustomerNumber) {
						this.setCorrItemsBasicField(mCorrItemsProperties.CustomerName, undefined, oContext);
					} else {
						this.setCorrItemsBasicField(mCorrItemsProperties.VendorName, undefined, oContext);
					}
				}.bind(this)
			).then(
				this.setCorrItemsBusyField.bind(this, sType, false, oContext)
			);

		},

		onFiscalYearChanged: function(oEvent) {
			var oContext = this.getActiveBindingContext();

			this.copyOdataToLocal(oContext);
			this._validateFiscalYear(oContext);
			this.setCorrItemsDialogField(mCorrItemsProperties.InvalidateDialog, true, oContext);
			this.onInputChanged();
		},

		onDocumentNumberChanged: function(oEvent) {
			var oContext = this.getActiveBindingContext();

			this.copyOdataToLocal(oContext);
			this._validateDocumentNumber(oContext);
			this.setCorrItemsDialogField(mCorrItemsProperties.InvalidateDialog, true, oContext);
			this.setCorrItemsEmailField(mCorrItemsProperties.InvalidateEmailTo, true, oContext);
			this.onInputChanged();
		},

		onDateChanged: function(oEvent) {
			var oContext = this.getActiveBindingContext();

			this.copyOdataToLocal(oContext);
			this._validateDates(oContext, true);
			this.onInputChanged();
		},

		onAdvancedParameterChange: function(oEvent) {
			var oContext = this.getActiveBindingContext();
			var sId = oEvent.getSource().getId();

			if (oEvent.getId() === mAdvancedParameterEvents.ValidationError) {
				var sLabel = oEvent.getParameter("label");

				this.updatePopoverMessagesModel({
					title: sLabel,
					subtitle: this.translateCoreText("VALUE_STATE_ERROR"),
					key: sId
				}, oContext);

			} else if (oEvent.getId() === mAdvancedParameterEvents.ValidationSuccess) {
				this.updatePopoverMessagesModel(undefined, oContext, sId);
			}

			this.onInputChanged();
		},

		onMessagePopover: function(oEvent) {
			this._oMessagePopover.openBy(oEvent.getSource());
		},

		/* =========================================================== */
		/* internal methods
		 /* =========================================================== */

		_setCorrespondenceStatus: function(sStatusName, bStatus, oContext) {
			oContext = oContext ? oContext : this.getActiveBindingContext(); // eslint-disable-line no-param-reassign

			this.setCorrItemsStateField(sStatusName, bStatus, oContext);

			var oItem = this._getItemByContext(oContext);

			switch (sStatusName) {
				case mCorrItemsProperties.EmailSent:
					oItem.setFirstStatus(new ObjectStatus({
						icon: "sap-icon://email"
					}));
					break;

				case mCorrItemsProperties.Printed:
					oItem.setSecondStatus(new ObjectStatus({
						icon: "sap-icon://print"
					}));
					break;
			}
		},

		/**
		 * Hides status (email/print used) icons of the correspondence item
		 * @param {object} oContext Binding context of corrItemsModel

		 * @private
		 */
		_resetCorrespondenceStatuses: function(oContext) {
			oContext = oContext ? oContext : this.getActiveBindingContext(); // eslint-disable-line no-param-reassign

			this.setCorrItemsStateField(mCorrItemsProperties.EmailSent, false, oContext);
			this.setCorrItemsStateField(mCorrItemsProperties.Printed, false, oContext);

			var oItem = this._getItemByContext(oContext);
			oItem.setFirstStatus();
			oItem.setSecondStatus();
		},

		/**
		 *
		 * @param {object} oContext Binding context of corrItemsModel
		 *
		 * @returns {object} sap.m.ObjectListItem item
		 * @private
		 */
		_getItemByContext: function(oContext) {
			var aItems = this.oList.getItems();
			var oItem = null;

			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getBindingContext(mModelNames.CorrItems) === oContext) {
					oItem = aItems[i];
					break;
				}
			}
			return oItem;
		},

		/**
		 * Process after company code change
		 *
		 * @param {object} oCompanyData data returned from company code validation
		 * @param {object} oContext corrItems model context
		 * @private
		 */
		_processCompanyCodeChange: function(oCompanyData, oContext) {
			if (oCompanyData) {
				this.setCorrItemsBasicField(mCorrItemsProperties.CompanyCodeName, oCompanyData.CompanyCodeName, oContext);
				this.setCorrItemsBasicField(mCorrItemsProperties.CompanyCode, oCompanyData.CompanyCode, oContext);
			}
		},

		/**
		 * Process after correspondence has changed
		 *
		 * @param {object} oContext corrItems model context
		 * @returns {Promise} promise
		 */
		_processCorrespondenceChange: function(oContext) {
			var that = this;

			var oPromise = new Promise(function(resolve) {
				var oItem = that.getSelectedCorrespondenceObject(oContext);

				// Correspondence not found
				if (!that.validateCorrespondenceType(oContext)) {
					that._resetCorrItemsModelVisibility(oContext);
					return;
				}

				that._setValueState(mInputFields.Event, ValueState.None, oContext);

				// change main mode
				that._setDataProperty(mInputFields.Event, oItem.Event);

				that._setDisplayFromCorrespondence(oItem, oContext);
				that.setCorrespondenceChannels(oItem, oContext);
				that._hidePdfAndEmailTabsContent(oContext);
				that.setCorrItemsVisibleField(mCorrItemsProperties.AdvancedParameters, false, oContext);
				that.setCorrItemsModelProperty(mModelPropertyTypes.SelectedCorrespondence, oItem, oContext);

				if (!oItem.AdvancedParameters) {
					that.getAdvancedParameters(oItem).then(function(oData) {
						var oParsedParameters = AdvancedParameters.parseAdvancedParameters(oData);
						var aGroups = oParsedParameters.Groups;
						var oNavigationAdvancedParameters = oContext.getObject().NavigationAdvancedParameters;

						oItem.HasMandatoryAdvanceParameter = oParsedParameters.HasMandatory;

						if (oNavigationAdvancedParameters) {
							Object.keys(oNavigationAdvancedParameters).forEach(function(sAdvName) {
								var aParamsSet;
								nestedFor: for (var i = 0; i < aGroups.length; i++) { // eslint-disable-line no-labels
									aParamsSet = aGroups[i].ParameterSet;
									for (var j = 0; j < aParamsSet.length; j++) {
										if (aParamsSet[j].Id === sAdvName) {
											aParamsSet[j].Value = oNavigationAdvancedParameters[sAdvName];
											break nestedFor;	// eslint-disable-line no-labels
										}
									}
								}
							});
						}


						that.setCorrItemsSelectedCorrespondenceField(mCorrItemsProperties.AdvancedParameters, aGroups, oContext);
						resolve(oItem);
					});
				}
				else {
					resolve(oItem);
				}
			});

			oPromise.then(function(oCorrType) {
				if (oCorrType.HasMandatoryAdvanceParameter) {
					that.onAdvancedParametersToggle();
				}
			});

			return oPromise;
		},

		getAdvancedParameters: function(oItem) {
			var that = this;

			return new Promise(function(resolve, reject) {
				that.oModel.read(
					"/" + that.oModel.createKey(mEntitySets.CorrTypeSet, {
						Event: oItem.Event,
						VariantId: oItem.VariantId,
						Id: oItem.Id
					}),
					{
						urlParameters: {
							"$expand": mEntitySets.ParameterSet + "," + mEntitySets.ParametersGroupSet
						},
						success: function(oData, oResponse) {
							oData = oData.results ? oData.results : oData; // eslint-disable-line no-param-reassign

							// oData model probably caches same requests and returns the same object, so we need to duplicate it
							oData = jQuery.extend(true, {}, oData); // eslint-disable-line no-param-reassign

							oData.ParameterSet.results.forEach(function(oParameter){
								if(oParameter.Type === "B"){
									if(oParameter.RawValue === ""){
										oParameter.RawValue = false;
									}
									else {
										oParameter.RawValue = true;
									}
								}
							});

							resolve(oData);
						}
					}
				);
			});
		},

		/**
		 * Sets corr channels into corr item models and enables buttons correspondingly
		 *
		 * @param {object} oSelectedCorrespondence selected correspondence item
		 * @param {object} oContext Binding context of corrItemsModel
		 */
		setCorrespondenceChannels: function(oSelectedCorrespondence, oContext) {
			var aChannels = oSelectedCorrespondence.SupportedChannelSet;

			var sPrintType = this._getType(aChannels, mPrinters);
			this.setCorrItemsModelProperty(mModelPropertyTypes.PrintType, sPrintType, oContext);
			this._setDisplayPrintProperty(sPrintType, oContext);
			this.setCorrItemsEnabledField(mCorrItemsProperties.PrintButton, !!sPrintType, oContext);

			var sEmailType = this._getType(aChannels, mEmailTypes);
			this.setCorrItemsModelProperty(mModelPropertyTypes.EmailType, sEmailType, oContext);
			this.setCorrItemsEnabledField(mCorrItemsProperties.EmailButton, !!sEmailType, oContext);
		},

		/**
		 * Returns object with properties of currently selected correspondence type
		 *
		 * @param {object} oContext corrItems model context
		 * @returns {object} currently selected correspondence type
		 */
		getSelectedCorrespondenceObject: function(oContext) {
			var sKey = this.getCorrItemsBasicField(mCorrItemsProperties.CorrespondenceType, oContext);

			return this.getCorrItemsModelProperty(mModelPropertyTypes.CorrespondenceTypes, oContext).filter(function(corr) {
				return this._formatCorrespondenceTypeKeyFromObject(corr) === sKey;
			}.bind(this)).shift();
		},

		_formatCorrespondenceTypeKeyFromObject: function (oCorrType) {
			return this.formatCorrespondenceTypeKey(oCorrType.Event, oCorrType.VariantId, oCorrType.Id);
		},

		/**
		 * Formats correspondence type key based on given parameters
		 *
		 * @param {string} sEvent corrItems event ID
		 * @param {string} sVariantId corrItems Id
		 * @param {string} sId corrItems variant Id
		 * @returns {string} formatted key
		 */
		formatCorrespondenceTypeKey: function (sEvent, sVariantId, sId) {
			if (!sEvent && !sVariantId && !sId) {
				return "";
			}

			return sEvent + "###" + sVariantId + "###" + sId;
		},

		/**
		 * Format correspondence item title based on given parameters
		 *
		 * @param {string} sTitle correspondence item title
		 * @param {string} sId correspondence item id
		 * @return {string} formatted title
		 */
		formatTitle: function(sTitle, sId) {
			var sRetTitle = "";

			if (sTitle) {
				sRetTitle = sTitle;
			} else if (sId) {
				sRetTitle = this.translateText("CORR_ITEM", [sId]);
			}

			return sRetTitle;
		},

		/**
		 * Format correspondence item's ID and text
		 *
		 * @param {string} sId item ID
		 * @param {string} sText item text
		 * @return {string} formatted ID & text
		 */
		formatCorrespondenceItem: function(sId, sText) {
			if (sId && sText) {
				return this.translateText("CORR_ITEM_ID_AND_TEXT", [sId, sText]);
			} else if (sId) {
				return sId;
			}
			return "";
		},

		_getItemTitle: function(oContext) {
			return this.formatTitle(oContext.getProperty(mCorrItemsProperties.Title), oContext.getProperty(mCorrItemsProperties.Id));
		},


		_isActiveCorrItem: function() {
			var oContext = this.getActiveBindingContext();

			return !!oContext && !!oContext.getProperty(mCorrItemsProperties.IsActive);
		},

		/**
		 * Validates input in combobox against list of its possible values
		 *
		 * @param {object} oContext context for corrItemsModel
		 *
		 * @returns {boolean} True if input is correct, false otherwise
		 */
		validateCorrespondenceType: function(oContext) {
			var sErrorMessage = this.translateText("CORR_TYPE_COMBOBOX_ERROR");
			var oSelectedItem = this.getSelectedCorrespondenceObject(oContext) || {};
			var bValid = false;

			if (oSelectedItem.Name) {
				var aItems = this.getCorrItemsModelProperty(mModelPropertyTypes.CorrespondenceTypes, oContext);
				aItems.forEach(function(oItem) {
					if (oItem.Name.trim() === oSelectedItem.Name.trim()) {
						bValid = true;
					}
				});
			}


			var sValueStatePath = ModelUtils.getValueStatePropertyPath(mCorrItemsProperties.CorrespondenceType);
			if (bValid) {
				this.setCorrItemsModelProperty(sValueStatePath, ValueState.None, oContext);
			} else {
				this.setCorrItemsModelProperty(sValueStatePath, ValueState.Error, oContext);

				var sValueStateTextPath = ModelUtils.getValueStateTextPropertyPath(mCorrItemsProperties.CorrespondenceType);
				this.setCorrItemsModelProperty(sValueStateTextPath, sErrorMessage, oContext);
			}

			return bValid;
		},

		/**
		 * Validates field based on regex pattern if field is visible
		 * @param {string} sFieldName Field binding name
		 * @param {string} sFieldValue Field value
		 * @param {object} oRegPattern Regular pattern condition
		 * @param {string} sErrorText Error state text
		 * @param {object} oContext context in corrItems model
		 * @param {boolean} [bSkipEmpty=false] If set to true, does not trigger error for empty value
		 *
		 * @returns {boolean} True if field valid or invisible
		 * @private
		 */
		_validateRegexField: function(sFieldName, sFieldValue, oRegPattern, sErrorText, oContext, bSkipEmpty) {
			sFieldValue = (sFieldValue) ? sFieldValue : ""; // eslint-disable-line no-param-reassign

			if (!!bSkipEmpty && sFieldValue === "") {
				return true;
			}

			var bIsVisible = this.getCorrItemsVisibleField(sFieldName, oContext);
			if (!bIsVisible) {
				return true;
			}

			var sValueState = ValueState.None;
			var oPopoverMessage;
			var sFieldToRemove;

			if (!oRegPattern.test(sFieldValue)) {
				this._setValueStateText(sFieldName, sErrorText);
				sValueState = ValueState.Error;
				oPopoverMessage = {
					title: this._getLabelForProperty.call(this, sFieldName),
					subtitle: sErrorText,
					key: sFieldName
				};
			} else {
				sFieldToRemove = sFieldName;
			}

			this._setValueState(sFieldName, sValueState);
			this.updatePopoverMessagesModel(oPopoverMessage, oContext, sFieldToRemove);

			return (sValueState === ValueState.None);
		},

		/**
		 * Validates document year field if visible and sets its appropriate state.
		 *
		 * @param {object} oContext context in corrItems model
		 * @param {boolean} [bSkipEmpty=false] If set to true, does not trigger error for empty value
		 * @returns {boolean} True if document year is valid or invisible
		 * @private
		 */
		_validateDocumentNumber: function(oContext, bSkipEmpty) {
			var sValue = this._getCorrItemPropertyValue(mInputFields.DocumentNumber, mCorrItemsProperties.DocumentNumber, oContext);

			return this._validateRegexField(mInputFields.DocumentNumber, sValue,
				mRegularPatterns.DocumentNumber, this.translateText("ERROR_DOCUMENT_NUMBER"), oContext, !!bSkipEmpty);
		},

		/**
		 * Validates fiscal year field if visible and sets its appropriate state.
		 *
		 * @param {object} oContext context in corrItems model
		 * @param {boolean} [bSkipEmpty=false] If set to true, does not trigger error for empty value
		 * @returns {boolean} True if fiscal year is valid or invisible
		 * @private
		 */
		_validateFiscalYear: function(oContext, bSkipEmpty) {
			var sValue = this._getCorrItemPropertyValue(mInputFields.FiscalYear, mCorrItemsProperties.FiscalYear, oContext);

			return this._validateRegexField(mInputFields.FiscalYear, sValue,
				mRegularPatterns.FiscalYear, this.translateText("ERROR_FISCAL_YEAR"), oContext, !!bSkipEmpty);
		},


		/**
		 * Validates Date1 and Date2 fields if visible and sets their appropriate state.
		 *
		 * @param {object} oContext context in corrItems model
		 * @param {boolean} [bSkipEmpty=false] If set to true, does not trigger error for empty value
		 * @returns {boolean} True if fields are valid and/or invisible
		 * @private
		 */
		_validateDates: function(oContext, bSkipEmpty) {
			var sErrorText = "";
			var sDate1State = ValueState.None;
			var sDate2State = ValueState.None;
			var oDatesInfo = this.getDatesInfo(oContext, bSkipEmpty);

			if (oDatesInfo.endDatePrecedesStartDate) {
				sErrorText = this.translateText("DATE_ERROR");
				sDate1State = sDate2State = ValueState.Error;
			} else if (!oDatesInfo.bothDatesValid) {
				sErrorText = this.translateText("DATE_FORMAT_ERROR");
				sDate1State = oDatesInfo.date1ValidOrHidden ? ValueState.None : ValueState.Error;
				sDate2State = oDatesInfo.date2ValidOrHidden ? ValueState.None : ValueState.Error;
			}

			this._setValueStateText(mInputFields.Date1, sErrorText, oContext);
			this._setValueStateText(mInputFields.Date2, sErrorText, oContext);

			this._setValueState(mInputFields.Date1, sDate1State, oContext);
			this._setValueState(mInputFields.Date2, sDate2State, oContext);

			this.updatePopoverMessageForDates(oDatesInfo, sErrorText, oContext);

			return oDatesInfo.bothDatesValid;
		},

		/**
		 * Returns formated date from date object to yyyyMMdd format
		 *
		 * @param {string} oDate date object
		 *
		 * @returns {string} date
		 * @private
		 */
		_formatDate: function(oDate) {
			if (oDate) {
				return oDateFormat.format(oDate);
			}
			return "";
		},

		/**
		 * Object describing the state of both DatePickers.
		 * @typedef {Object} DatesInfo
		 * @property {boolean} date1Visible - Date1 visibility
		 * @property {boolean} date2Visible - Date2 visibility
		 * @property {boolean} date1ValidOrHidden - Date1 is valid or hidden
		 * @property {boolean} date2ValidOrHidden - Date2 is valid or hidden
		 * @property {boolean} endDatePrecedesStartDate - Date2 is before Date1
		 * @property {boolean} bothDatesValid - Date1 and Date2 are both valid
		 */

		/**
		 * Returns information about date pickers.
		 *
		 * @param {object} oContext context in corrItems model
		 * @param {boolean} [bSkipEmpty=false] If set to true, empty value does not cause Error state.
		 * @returns {DatesInfo} Information about DatePickers.
		 */
		getDatesInfo: function(oContext, bSkipEmpty) {
			var bDate1IsEmpty = !this._getCorrItemPropertyValue(mInputFields.Date1, mCorrItemsProperties.Date1, oContext);
			var bDate2IsEmpty = !this._getCorrItemPropertyValue(mInputFields.Date2, mCorrItemsProperties.Date2, oContext);
			var sDate1 = this._formatDate(this.getCorrItemsBasicField(mCorrItemsProperties.Date1, oContext));
			var sDate2 = this._formatDate(this.getCorrItemsBasicField(mCorrItemsProperties.Date2, oContext));
			var bDate1Visible = this.getCorrItemsVisibleField(mCorrItemsProperties.Date1, oContext);
			var bDate2Visible = this.getCorrItemsVisibleField(mCorrItemsProperties.Date2, oContext);
			var bDate1Valid = (bDate1IsEmpty) ? !!bSkipEmpty : this.byId(mIds.Date1)._bValid;
			var bDate2Valid = (bDate2IsEmpty) ? !!bSkipEmpty : this.byId(mIds.Date2)._bValid;
			var oDatesInfo = {};

			oDatesInfo.date1Visible = bDate1Visible;
			oDatesInfo.date2Visible = bDate2Visible;

			oDatesInfo.endDatePrecedesStartDate = bDate1Visible && bDate2Visible && bDate1Valid && bDate2Valid && !!sDate1 && !!sDate2 && sDate2 < sDate1;

			oDatesInfo.date1ValidOrHidden = (bDate1Valid || !bDate1Visible) && !oDatesInfo.endDatePrecedesStartDate;
			oDatesInfo.date2ValidOrHidden = (bDate2Valid || !bDate2Visible) && !oDatesInfo.endDatePrecedesStartDate;

			oDatesInfo.bothDatesValid = oDatesInfo.date1ValidOrHidden && oDatesInfo.date2ValidOrHidden;

			return oDatesInfo;
		},

		/**
		 * Create MessagePopover items for dates if necessary.
		 * @param {DatesInfo} oDatesInfo Object describing information about date controls.
		 * @param {string} sErrorMessage Error message to be shown in item in MessagePopover.
		 * @param {object} oContext context in corrItems model

		 */
		updatePopoverMessageForDates: function(oDatesInfo, sErrorMessage, oContext) {
			var aValidFields = [],
				aNewMessages = [];

			if (!oDatesInfo.date1ValidOrHidden) {
				aNewMessages.push({
					title: this.getCorrItemsSelectedCorrespondenceField(mFieldLabels.Date1, oContext),
					subtitle: sErrorMessage,
					key: mInputFields.Date1
				});
			} else {
				aValidFields.push(mInputFields.Date1);
			}

			if (!oDatesInfo.date2ValidOrHidden) {
				aNewMessages.push({
					title: this.getCorrItemsSelectedCorrespondenceField(mFieldLabels.Date2, oContext),
					subtitle: sErrorMessage,
					key: mInputFields.Date2
				});
			} else {
				aValidFields.push(mInputFields.Date2);
			}

			this.updatePopoverMessagesModel(aNewMessages, oContext, aValidFields);
		},

		/**
		 * Updates messages in MessagePopover model.
		 * @param {[]|object|undefined} vNewMessages Messages to be added.
		 * @param {object} [oContext] if not given, active context of the view is used

		 * @param {[]|string} [vFieldsToBeRemoved=[]] Field keys that are in Error state.
		 * @param {boolean} [bMerge=true] If set to false, removes all other messages. Otherwise adds messages to already existing messages.
		 */
		updatePopoverMessagesModel: function(vNewMessages, oContext, vFieldsToBeRemoved, bMerge) {
			oContext = oContext ? oContext : this.getActiveBindingContext(); // eslint-disable-line no-param-reassign

			if (!oContext) {
				return;
			}

			if (typeof bMerge === "undefined") {
				bMerge = (typeof arguments[1] === "boolean") ? arguments[1] : true; // eslint-disable-line no-param-reassign

			}

			var aNewMessages = vNewMessages;
			if (!jQuery.isArray(vNewMessages)) {
				aNewMessages = (typeof vNewMessages === "undefined") ? [] : [vNewMessages];
			}

			var aFieldsToBeRemoved = vFieldsToBeRemoved;
			if (typeof vFieldsToBeRemoved === "string") {
				aFieldsToBeRemoved = [vFieldsToBeRemoved];
			} else if (!jQuery.isArray(vFieldsToBeRemoved)) {
				aFieldsToBeRemoved = [];
			}

			var i;
			for (i = 0; i < aNewMessages.length; i++) {
				aNewMessages[i].key = this._getMessageKey(oContext, aNewMessages[i].key);
				aNewMessages[i][mModelPropertyTypes.Id] = oContext.getProperty(mModelPropertyTypes.Id);
			}

			for (i = 0; i < aFieldsToBeRemoved.length; i++) {
				aFieldsToBeRemoved[i] = this._getMessageKey(oContext, aFieldsToBeRemoved[i]);
			}

			var aMessages = bMerge ? this.oMessagePopoverModel.getProperty("/messages") : [];

			aNewMessages.forEach(function(oMessage) {
				aFieldsToBeRemoved.push(oMessage.key);
			});

			aMessages = aMessages.filter(function(oMessage) {
				jQuery.sap.assert(typeof oMessage.key === "string", "Message key must be a string.");
				return jQuery.inArray(oMessage.key, aFieldsToBeRemoved) === -1;
			});

			aNewMessages = aNewMessages.concat(aMessages);

			this.handleMessagePopoverDialog(aNewMessages, oContext);
		},

		/**
		 * Removes Popover Messages from model.
		 * @param {[]|string} vFields Field keys to be removed.
		 * @param {object} [oContext] if not given, context of the active item is used

		 */
		removePopoverMessages: function(vFields, oContext) {
			oContext = oContext ? oContext : this.getActiveBindingContext(); // eslint-disable-line no-param-reassign

			if (!oContext) {
				return;
			}

			var aOldMessages = this.oMessagePopoverModel.getProperty("/messages");
			if (aOldMessages.length === 0) {
				return;
			}

			var aFieldToBeRemoved = (jQuery.isArray(vFields)) ? vFields : [vFields];

			this.updatePopoverMessagesModel(undefined, oContext, aFieldToBeRemoved);
		},

		/**
		 * Removes all messages from the model.
		 */
		clearPopoverMessages: function() {
			this.updatePopoverMessagesModel([], this.getActiveBindingContext(), [], false);
		},

		/**
		 * Opens or closes message popover dialog based on its state (opened/closed) and number of messages
		 * and sets messages to model
		 *
		 * @param {Array} aNewMessages messages to be set to MessagePopoverModel
		 * @param {object} oContext context in corrItems model

		 */
		handleMessagePopoverDialog: function(aNewMessages, oContext) {
			if (this._oMessagePopover.isOpen() && aNewMessages.length === 0) {
				var fnSetMessages = function() {
					this.oMessagePopoverModel.setProperty("/messages", aNewMessages);
				}.bind(this);

				this._oMessagePopover.attachEventOnce("afterClose", fnSetMessages);
				this._oMessagePopover.close();
			} else {
				this.oMessagePopoverModel.setProperty("/messages", aNewMessages);

				if (this.shouldOpenMessagePopover(aNewMessages, oContext)) {
					this.openMessagePopover();
				}
			}
		},

		/**
		 * Determines if message popover dialog should open.
		 *
		 * @param {Array} aMessages messages to be set to MessagePopoverModel
		 * @returns {boolean} true if dialog should open
		 * @param {object} oContext context in corrItems model

		 */
		shouldOpenMessagePopover: function(aMessages, oContext) {
			var bAnyRelatedMessage = false;

			aMessages.forEach(function(oMessage) {
				if (oMessage[mModelPropertyTypes.Id] === oContext.getProperty(mModelPropertyTypes.Id)) {
					bAnyRelatedMessage = true;
				}
			});

			return !this.isAnyDialogOpen() && aMessages.length > 0 && bAnyRelatedMessage && !this._oMessagePopover.isOpen();
		},

		openMessagePopover: function() {
			if (this.oMessagePopoverButton.getDomRef()) {
				this._oMessagePopover.openBy(this.oMessagePopoverButton);
			} else {
				var that = this;
				var oDelegate = {
					onAfterRendering: function() {
						that._oMessagePopover.openBy(that.oMessagePopoverButton);
						that.oMessagePopoverButton.removeEventDelegate(oDelegate);
					}
				};

				this.oMessagePopoverButton.addEventDelegate(oDelegate);
			}
		},

		/**
		 * Returns an array of keys for hidden fields.
		 * @returns {[]} Keys for hidden fields
		 */
		getHiddenFieldKeys: function() {
			var oFieldVisibility = this.getCorrItemsModelProperty(mModelPropertyTypes.Visible);

			return Object.keys(mInputFields).filter(function(sKey) {
				return !oFieldVisibility[sKey];
			});
		},

		/**
		 * For valid input opens dialog and provides it with default data
		 * @param {object} oOptions Custom options that are passed to dialog controller
		 * @param {object} oOptions.controller Controller object
		 * @param {object} oOptions.dialog Dialog object
		 * @param {string} oOptions.dialogType Type of dialog Mappings.DialogTypes
		 * @param {boolean} [bSkipValidation=false] if active item should be validated
		 * @param {object} oContext corrItems model context
		 * @private
		 */
		_openDialog: function(oOptions, bSkipValidation, oContext) {
			var that = this;
			oContext = oContext ? oContext : this.getActiveBindingContext(); // eslint-disable-line no-param-reassign
			var bValid = (bSkipValidation || this._validateCorrespondenceItemInput(oContext));

			if (bValid) {
				this.loadDefaultsForDialog(oContext).then(function(aData) {
					oOptions.defaultData = ModelUtils.getDefaultDialogData(oOptions.dialogType, aData, oContext);
					oOptions.controller.setData(oOptions, that.getActiveBindingContext());

					if (that._isMicrosoftBrowser()) {
						that._setPdfVisibility(false);
					}

					jQuery.sap.syncStyleClass("sapUiSizeCompact", that.getView(), oOptions.dialog);
					oOptions.dialog.open();
				});
			}
		},

		/**
		 * Sets the display data based on the selected correspondence
		 * @param {object} oCorr Correspondence object
		 * @param {object} oContext Binding context for corrItemsModel
		 * @private
		 */
		_setDisplayFromCorrespondence: function(oCorr, oContext) {
			this.setCorrItemsVisibleField(mCorrItemsProperties.AccountType, oCorr.RequiresAccountNumber);
			this.setCorrItemsVisibleField(mCorrItemsProperties.Date1, (oCorr.NumberOfDates > 0));
			this.setCorrItemsVisibleField(mCorrItemsProperties.Date2, (oCorr.NumberOfDates > 1));
			this.setCorrItemsVisibleField(mCorrItemsProperties.DocumentNumber, oCorr.RequiresDocument);
			this.setCorrItemsVisibleField(mCorrItemsProperties.FiscalYear, oCorr.RequiresDocument);

			var iAccountTypeIndex = this.getCorrItemsStateField(mCorrItemsProperties.AccountTypeIndex, oContext);
			var bCustomerVisible = (oCorr.RequiresAccountNumber && iAccountTypeIndex === 0);
			var bVendorVisible = (oCorr.RequiresAccountNumber && iAccountTypeIndex === 1);

			this.setCorrItemsVisibleField(mCorrItemsProperties.CustomerNumber, bCustomerVisible);
			this.setCorrItemsVisibleField(mCorrItemsProperties.VendorNumber, bVendorVisible);

			// if customer number or vendor number is visible change accounttype
			if (bCustomerVisible || bVendorVisible) {
				var sAccountType = (bCustomerVisible ? mAccountType.Customer : mAccountType.Vendor);
				this.setCorrItemsBasicField(mCorrItemsProperties.AccountType, sAccountType, oContext);
			}
		},

		/**
		 * Process after preview pressed
		 * @param {boolean} [aCorrItems] Correspondence items to be validated. Defaults to active one.
		 */
		_processPreview: function(aCorrItems) {
			this.setActiveTab(mIds.IconTabBarFilterPdf);
			this._processCorrespondence(aCorrItems);
		},

		_processCorrespondence: function(aCorrItems) {
			var oContext = this.getActiveBindingContext();
			if (!this._validateInput(aCorrItems)) {
				this.setActiveTab(mIds.IconTabBarFilterCorrData);

				return;
			}

			this._storeCurrentAppState();

			if (this._isMicrosoftBrowser()) {
				this._setPdfVisibility(true);
			}

			if (!oContext) {
				return;
			}

			var oPromise = Promise.resolve();
			var oParameters = this.getInputData(oContext);
			var sJsonParameters = JSON.stringify(oParameters);
			if (sJsonParameters !== this.getCorrItemsModelProperty(mCorrItemsProperties.CachedJsonParameters)) {
				this.setCorrItemsModelProperty(mCorrItemsProperties.CachedJsonParameters, sJsonParameters);
				oPromise
					= oPromise
						.then(this._getApplicationObjectIdFromServer.bind(this, oParameters))
						.then(this._createPathToPdfFromApplicationObjectId.bind(this))
						.then(this._setPdfUrl.bind(this));
			}
			oPromise
				.then(this._showPdfAndEmailTabsContent.bind(this, oContext))
				.then(this._loadEmailPreviewTab.bind(this, oContext));
		},

		/**
		 * Check if current browser is IE or Edge
		 *
		 * @private
		 * @returns {boolean} True if browser is IE or Edge, otherwise false
		 */
		_isMicrosoftBrowser: function() {
			return Device.browser.msie || Device.browser.edge;
		},

		/**
		 * Check if current device is phone or tablet
		 *
		 * @private
		 * @returns {boolean} True if device is phone or tablet, otherwise false
		 */
		_isMobileDevice: function() {
			return !Device.os.windows && (Device.system.tablet || Device.system.phone);
		},

		_handleParseError: function(oEvent) {
			var oElement = oEvent.getParameter("element");
			if (oElement.setValueState) {
				oElement.setValueState(ValueState.Error);
			}
		},

		_handleValidationError: function(oEvent) {
			var oElement = oEvent.getParameter("element");
			if (oElement.setValueState) {
				oElement.setValueState(ValueState.Error);
				oElement.setValueStateText(oEvent.getParameter("message"));
			}
		},

		_handleValidationSuccess: function(oEvent) {
			var oElement = oEvent.getParameter("element");
			if (oElement.setValueState) {
				oElement.setValueState(ValueState.None);
				oElement.setValueStateText(null);
			}
		},

		/**
		 * Set up error handler for automatic marking controls (red mark when invalid)
		 *
		 * @private
		 */
		_initErrorHandlers: function() {
			sap.ui.getCore().attachParseError(this._handleParseError);
			sap.ui.getCore().attachValidationError(this._handleValidationError);
			sap.ui.getCore().attachValidationSuccess(this._handleValidationSuccess);
		},

		onExit: function() {
			sap.ui.getCore().detachParseError(this._handleParseError);
			sap.ui.getCore().detachValidationError(this._handleValidationError);
			sap.ui.getCore().detachValidationSuccess(this._handleValidationSuccess);
		},

		/**
		 * Changes the URL according to the current app state and stores the app state for later retrieval.
		 * @returns {Promise} AppState promise with results
		 */
		_storeCurrentAppState: function() {
			var oAppStatePromise = this.oNavigationHandler.storeInnerAppState(this._getCurrentAppState()),
				that = this;
			oAppStatePromise.fail(function(oError) {
				that._errorHandler.showError(that.translateText("STORE_ERROR"));
			});
			return oAppStatePromise;
		},

		/**
		 * Returns app state object create from current input values
		 *
		 * @returns {object} the current app state consisting of the selection variant
		 */
		_getCurrentAppState: function() {
			this.copyOdataToLocal();

			var oFilteredCorrItems = jQuery.extend(true, {}, this.oCorrItemsModel.getData());
			Object.keys(oFilteredCorrItems).forEach(function (sCorrItemKey) {
				delete oFilteredCorrItems[sCorrItemKey].CorrespondenceTypes;
			});

			return {
				customData: {
					CorrItemsModel: oFilteredCorrItems,
					DisplayModel: jQuery.extend(true, {}, this.oDisplayModel.getData()),
					GlobalSettingsModel: jQuery.extend(true, {}, this.oGlobalSettingsModel.getData()),
					StateModel: jQuery.extend(true, {}, this.oStateModel.getData())
				}
			};
		},

		/**
		 * Set up initial values. These values can be changed either from external application (in that case user is not allowed to change them) or they can be set from launchpad
		 * default values. In such scenario user is allowed to modify the values.
		 *
		 * @private
		 */
		_initParameters: function() {
			var that = this;
			this.oNavigationHandler.parseNavigation().done(function(oAppData, oURLParameters, sNavType) {
				if (sNavType !== NavType.initial) {
					that.removeCorrItems(that.oActiveCorrListItem);
					that.iCorrIndex--;
					if (sNavType === NavType.iAppState) {
						that._handleInnerAppState(oAppData.customData);
						return;
					}

					var oParameters = UrlParameterParser.parseNavigation(oURLParameters);
					if (oParameters === null) {
						// user used invalid URL parameters, ignore it and create empty correspondence item
						that.createNewCorrItem();
						return;
					}

					if(oParameters.Settings && oParameters.Settings.DownloadXML){
						oParameters.Settings.NotDownloadXML = !oParameters.Settings.DownloadXML;
						if(!oParameters.Correspondences || (Array.isArray(oParameters.Correspondences) && oParameters.Correspondences.length === 0)){
							that.createNewCorrItem();
						}
					}

					var oNewGlobalSettings = UrlParameterParser.mergeGlobalSettings(oParameters.Settings, that.oGlobalSettingsModel.getData());
					oNewGlobalSettings.OverviewFields = UrlParameterParser.getOverviewFields(oParameters.OverviewFields);

					if (oParameters.FLP) {
						oNewGlobalSettings.TriggerPreview = false;
					}

					that.oGlobalSettingsModel.setData(oNewGlobalSettings);

					var oUrlData = {};
					oUrlData.Editable = oParameters.Editable;
					oUrlData.DefaultParameters = oParameters.DefaultParameters;

					that._setMultiSelectMode(oParameters.Settings);
					that.setApplicationTitle(oNewGlobalSettings.ApplicationTitle);

					var aCorrespondences = oParameters.Correspondences;
					if(jQuery.isArray(aCorrespondences)){
						that._handleExternalCorrespondences(aCorrespondences, oUrlData);
					}
				}
			});
		},

		_handleExternalCorrespondences: function(aCorrespondences, oUrlData) {
			var that = this;
			var aPromises = [];

			this.setBusy();

			aCorrespondences.forEach(function(oItem) {
				if (typeof oItem !== "object" || jQuery.isArray(oItem)) {
					return;
				}
				aPromises.push(that._handleExternalCorrespondence(oItem, oUrlData));
			});

			Promise.all(aPromises).then(function() {
				that.setNotBusy();

				setTimeout(function() {
					if (that._isMultiSelectMode()) {
						var bSelected = that._getModelProperty(that.oStateModel, mStateProperties.SelectAll);
						that.selectAllCorresppondences(bSelected);
					}

					var bTriggerPreview = that._getModelProperty(that.oGlobalSettingsModel, mGlobalSettingsProperties.TriggerPreview);
					if (bTriggerPreview) {
						that._processPreview();
					}
				}, 0);
			});
		},

		_handleExternalCorrespondence: function(oItem, oUrlData) {
			var that = this;

			return new Promise(function(resolve, reject) {
				var oNavigationAdvancedParameters = oItem.AdvancedParameters;

				if(oUrlData.DefaultParameters && oUrlData.DefaultParameters.AdvancedParameters && typeof oUrlData.DefaultParameters.AdvancedParameters === "object"){
					oNavigationAdvancedParameters = UrlParameterParser.mergeAdvancedParameters(oNavigationAdvancedParameters, oUrlData.DefaultParameters.AdvancedParameters);
				}

				delete oItem.AdvancedParameters;
				oUrlData.BasicFields = oItem;

				var oCorrespondenceData = UrlParameterParser.getCorrespondenceData(oUrlData);
				oCorrespondenceData.NavigationAdvancedParameters = oNavigationAdvancedParameters;
				var sCompanyCode = oCorrespondenceData.BasicFields.CompanyCode;

				if (oCorrespondenceData.BasicFields.CorrespondenceType) {
					oCorrespondenceData.BasicFields.CorrespondenceType = that._formatCorrespondenceTypeKeyFromObject(oCorrespondenceData.BasicFields.CorrespondenceType);
				} else {
					oCorrespondenceData.BasicFields.CorrespondenceType = "";
				}

				oCorrespondenceData.Email = UrlParameterParser.getEmailData(oItem, oUrlData.DefaultParameters);

				if (sCompanyCode) {
					that.serverValidateCompanyCode(sCompanyCode).then(function(data) {
						that._getCorrespondeces(sCompanyCode).then(function(aData) {
							oCorrespondenceData.CorrespondenceTypes = aData;

							var oSelectedCorrespondence = that._getSelectedCorrespondence(oCorrespondenceData.BasicFields.CorrespondenceType, aData);
							if (!oSelectedCorrespondence) {
								oCorrespondenceData.BasicFields.CorrespondenceType = "";
							} else {
								oCorrespondenceData.SelectedCorrespondence = oSelectedCorrespondence;
								oCorrespondenceData = UrlParameterParser.getVisibleData(oCorrespondenceData, oSelectedCorrespondence);

							}

							var bLoadEmailValues = Object.getOwnPropertyNames(oCorrespondenceData.Email).length > 0;

							that._setActiveCorrespodenceData(oCorrespondenceData, {loadEmailValues: bLoadEmailValues, returnPromise: true}).then(function(oContext) {

								if (oSelectedCorrespondence) {
									var oPromiseGetAdvParams = that._processCorrespondenceChange(oContext);
									that._processCompanyCodeChange(data, oContext);

									var sAccountType = that.getCorrItemsBasicField(mCorrItemsProperties.AccountType, oContext);
									var sCustomerNumber = that.getCorrItemsBasicField(mCorrItemsProperties.CustomerNumber, oContext);
									var sVendorNumber = that.getCorrItemsBasicField(mCorrItemsProperties.VendorNumber, oContext);
									var sAccountNumber = "";
									var sType = "";
									if (sAccountType === mAccountType.Customer) {
										sAccountNumber = sCustomerNumber;
										sType = mInputFields.CustomerNumber;
									} else if (sAccountType === mAccountType.Vendor) {
										sAccountNumber = sVendorNumber;
										sType = mInputFields.VendorNumber;
									}
									that.validateAccountNumber(sType, sAccountNumber, oContext);

									oPromiseGetAdvParams.then(function(oSelectedItem) {
										if (bLoadEmailValues) {
											that.oEmailFormController.loadAndRenderTemplates(oContext).then(function () {
												if (that.getCorrItemsEmailField(mCorrItemsProperties.TemplateKey, oContext)) {
													var oRenderPreview = that.oEmailFormController.getAndRenderPreview(oContext);
													oRenderPreview.then(resolve, resolve);
												} else {
													resolve();
												}
											});
										} else {
											resolve();
										}
									});
								} else {
									that._processCompanyCodeChange(data, oContext);
									that._processAccountNumberChanged(oContext);
									resolve();
								}
							});

						}, function(oData) {
							oCorrespondenceData.BasicFields.CorrespondenceType = "";
							that._setActiveCorrespodenceData(oCorrespondenceData, {
								errorData: oData
							});
							resolve();
						});
					}, function() {
						oCorrespondenceData.BasicFields.CorrespondenceType = "";

						var oContext = that._setActiveCorrespodenceData(oCorrespondenceData);
						var sErrorMessage = that.translateText("INVALIDCOMPANY");
						that._handleWrongCompanyCode(sErrorMessage, oContext);
						resolve();

					});
				} else {
					that._setActiveCorrespodenceData(oCorrespondenceData);
					resolve();
				}
			});
		},

		_setMultiSelectMode: function(oSettings) {
			if (!oSettings) {
				return;
			}

			if (oSettings.MultiSelectMode) {
				this._setModelProperty(this.oStateModel, mStateProperties.SelectAllVisible, true);
				this._setModelProperty(this.oStateModel, mStateProperties.ListMode, ListMode.MultiSelect);
			}

			if (typeof oSettings.SelectAll === "boolean") {
				this._setModelProperty(this.oStateModel, mStateProperties.SelectAll, oSettings.SelectAll);
			}
		},

		setApplicationTitle: function(sTitle) {
			if (!sTitle) {
				return;
			}

			this.getOwnerComponent().getService(mServices.ShellUIService).then(
				function(oService) {
					// locate-reuse-libs.js required for running the mockserver using fiori tools overwrite
					// our first attempt to set the title.
					setTimeout(function() {
						oService.setTitle(sTitle);
					}, 0);
				}.bind(this),
				function(oError) {
					jQuery.sap.log.error("Cannot get ShellUIService", oError, "Main.controller.js");
				}
			);
		},

		_handleInnerAppState: function(oInnerAppState) {
			var oModelsUpdatePromise = this._setModelsFromInnerAppState(oInnerAppState);

			oModelsUpdatePromise.then(function (iActiveCorrPosition) {
				this.oCorrItemsModel.refresh(true);
				this.switchToItem(iActiveCorrPosition);
			}.bind(this));
		},

		/**
		 * Sets inner models based on data from inner app state
		 *
		 * @param {object} oInnerAppState inner application state object
		 * @param {object} oInnerAppState.CorrItemsModel correspondence items model
		 * @param {object} oInnerAppState.DisplayModel visibility model
		 * @param {object} oInnerAppState.GlobalSettingsModel global settings model
		 * @param {object} oInnerAppState.StateModel handles state model
		 * @returns {number} index of active correspondence item
		 * @private
		 */
		_setModelsFromInnerAppState: function(oInnerAppState) {
			var iActiveCorrPosition = -1;

			if (typeof oInnerAppState !== "object") {
				return iActiveCorrPosition;
			}

			var aModelUpdatePromises = [];

			var oCorrItemsModel = oInnerAppState.CorrItemsModel;
			if (typeof oCorrItemsModel === "object") {
				var oPromise = this._setCorrItemsModel(oCorrItemsModel);
				aModelUpdatePromises.push(oPromise);

				Object.keys(oCorrItemsModel).forEach(function(sCorrId, iIndex) {
					if (oCorrItemsModel[sCorrId].IsActive) {
						iActiveCorrPosition = iIndex + 1;
					}
				});
			}

			return Promise.all(aModelUpdatePromises).then(function () {
				if (typeof oInnerAppState.DisplayModel === "object") {
					this.oDisplayModel.setData(oInnerAppState.DisplayModel);
				}

				if (typeof oInnerAppState.GlobalSettingsModel === "object") {
					this.oGlobalSettingsModel.setData(oInnerAppState.GlobalSettingsModel);
				}

				if (typeof oInnerAppState.StateModel === "object") {
					this.oStateModel.setData(oInnerAppState.StateModel);
				}

				return iActiveCorrPosition;
			}.bind(this));
		},

		_setCorrItemsModel: function(oCorrItemsModel) {
			var oPromises = [];

			// prepare models
			Object.keys(oCorrItemsModel).forEach(function(sIndex) {
				var oCorrItem = oCorrItemsModel[sIndex];

				if (oCorrItem.BasicFields.Date1) {
					oCorrItem.BasicFields.Date1 = new Date(oCorrItem.BasicFields.Date1);
				}

				if (oCorrItem.BasicFields.Date2) {
					oCorrItem.BasicFields.Date2 = new Date(oCorrItem.BasicFields.Date2);
				}

				if (!oCorrItem.CorrespondenceTypes && oCorrItem.BasicFields.CompanyCode) {
					oPromises.push(
						this._getCorrespondeces(oCorrItem.BasicFields.CompanyCode).then(function(aData) {
							oCorrItem.CorrespondenceTypes = aData;
						}.bind(this))
					);
				}
			}, this);

			// set the models
			return Promise.all(oPromises).then(function () {
				Object.keys(oCorrItemsModel).forEach(function(sIndex) {
					var oCorrItem = oCorrItemsModel[sIndex];
					this._setActiveCorrespodenceData(oCorrItem);
				}, this);
			}.bind(this));
		},

		_getSelectedCorrespondence: function(sType, aCorrespondences) {
			var oCorrespondence = null;
			aCorrespondences.forEach(function(oItem) {
				if (this._formatCorrespondenceTypeKeyFromObject(oItem) === sType) {
					oCorrespondence = oItem;
				}
			}.bind(this));

			return oCorrespondence;
		},

		/**
		 *
		 * @param {object} oData correspondence data
		 * @param {object} [oParams] settings for this function
		 * @param {object} [oParams.errorData] with error message
		 * @param {boolean} [oParams.loadEmailValues=false] whether for the new correspondence should be asynchronously loaded default data and other values
		 * @param {boolean} [oParams.returnPromise=false] whether the method should return promise
		 * @return {object} promise which returns context if loadEmailValues or returnPromise true, otherwise directly context
		 * @private
		 */
		_setActiveCorrespodenceData: function(oData, oParams) {
			this.createNewCorrItem();

			var that = this;

			oParams = oParams ? oParams : {}; // eslint-disable-line no-param-reassign

			// store the params that are set from api, load defaults and then overwrite the loaded data with the provided data from api
			var oEmailDataFromApi = jQuery.extend({}, oData.Email);
			var oErrorData = oParams.errorData;
			var bLoadEmailValues = !!oParams.loadEmailValues;
			var oContext = this.getActiveBindingContext();
			var sPath = this.getCorrItemsModelContextBindingPath(oContext);
			var oModel = this.oCorrItemsModel;
			oData = jQuery.extend(true, {}, oModel.getProperty(sPath), oData); // eslint-disable-line no-param-reassign
			oModel.setProperty(sPath, oData);

			// check if there was invalid company code
			if (oErrorData && oErrorData.ErrorMessage) {
				var sValueStatePath = ModelUtils.getValueStatePropertyPath(mCorrItemsProperties.CompanyCode);
				var sValueStateTextPath = ModelUtils.getValueStateTextPropertyPath(mCorrItemsProperties.CompanyCode);
				var sEditablePath = ModelUtils.getEditablePropertyPath(mCorrItemsProperties.CorrespondenceType);
				sValueStatePath = oContext.getPath(sValueStatePath);
				sValueStateTextPath = oContext.getPath(sValueStateTextPath);
				sEditablePath = oContext.getPath(sEditablePath);

				oModel.setProperty(sValueStatePath, ValueState.Error);
				oModel.setProperty(sValueStateTextPath, oErrorData.ErrorMessage);
				oModel.setProperty(sEditablePath, false);
			}
			this.copyLocaltoOData(oContext);

			if (bLoadEmailValues) {
				return this._loadEmailPreviewTab(oContext).then(function() {
					Object.keys(oEmailDataFromApi).forEach(function(sParam) {
						that.setCorrItemsEmailField(sParam, oEmailDataFromApi[sParam], oContext);
					});

					return oContext;
				});
			} else {
				if (oParams.returnPromise) {
					return Promise.resolve(oContext);
				}

				return oContext;
			}
		},
		/**
		 * Bind correspondence collection to control and sets placeholder "select correspondence".
		 * @param {array} aData Array with all loaded correspondence for selected company code.
		 * @param {string} sPreselectedKey if there preselected key among correspondences, select it
		 * @param {object} oContext context in corrItems model
		 *
		 * @private
		 * @returns {object} if there was any sPreselectKey set, return any item found by this key (if any)
		 */
		_bindCorrespondence: function(aData, sPreselectedKey, oContext) {
			var oItem;

			this.setCorrItemsBasicField(mCorrItemsProperties.CorrespondenceType, "", oContext);
			this.setCorrItemsModelProperty(mModelPropertyTypes.CorrespondenceTypes, aData, oContext);

			if (sPreselectedKey) {
				oItem = aData.filter(function(corr) {
					return this._formatCorrespondenceTypeKeyFromObject(corr) === sPreselectedKey;
				}.bind(this)).shift();

				this.setCorrItemsBasicField(mCorrItemsProperties.CorrespondenceType, sPreselectedKey, oContext);
			}

			this.setCorrItemsEditableField(mCorrItemsProperties.CorrespondenceType, aData.length > 0, oContext);

			// select correspondence if there is only one
			if (aData.length === 1) {
				oItem = aData[0];
				var sItemKey = this._formatCorrespondenceTypeKeyFromObject(oItem);
				this.setCorrItemsBasicField(mCorrItemsProperties.CorrespondenceType, sItemKey, oContext);
			}

			return oItem;
		},

		/**
		 * Returns promise with all correspondences for selected company code.
		 * This method may fail with two results =>
		 *  A. Company code is invalid - in this case, company code selector is marked as invalid, user has to change the company code).
		 *  B. Any other service error - if server provides any additional information it's displayed otherwise standard message box error is displayed.
		 *
		 * @param {string} sCompanyCode Selected company code.
		 * @returns {Promise} Promise with returned correspondences from server
		 * @private
		 */
		_getCorrespondeces: function(sCompanyCode) {
			var that = this;

			return new Promise(function(resolve, reject) {
				that.oModel.read("/" + mEntitySets.CorrTypeSet, {
					filters: [
						new Filter({
							path: mCorrItemsProperties.CompanyCode,
							value1: sCompanyCode,
							operator: FilterOperator.EQ
						})
					],
					urlParameters: {
						"$expand": mEntitySets.SupportedChannelSet
					},
					success: function(aData, oResponse) {
						aData = (aData.results) ? aData.results : aData; // eslint-disable-line no-param-reassign

						aData.forEach(function(oCorr) {
							var oItem = oCorr.SupportedChannelSet;
							oCorr.SupportedChannelSet = (oItem.results) ? oItem.results : oItem;
						});
						that.removePopoverMessages(mInputFields.CompanyCode);

						resolve(aData);
					},
					error: function(oData, oResponse) {
						reject(oData);
					}
				});
			});
		},

		validateCompanyCode: function(sCompanyCode, oContext) {
			var that = this;

			this.serverValidateCompanyCode(sCompanyCode, oContext).then(function(data) {
				that.setCorrItemsBusyField(mCorrItemsProperties.CorrespondenceType, true, oContext);

				that._getCorrespondeces(sCompanyCode).then(function(aData) {
					var sKey = that.getCorrItemsBasicField(mCorrItemsProperties.CorrespondenceType, oContext);
					if (that._bindCorrespondence(aData, sKey, oContext)) {
						// force display set based on the preselected item
						that._processCorrespondenceChange(oContext);
					}
					that._processCompanyCodeChange(data, oContext);
				}).then(
					that.setCorrItemsBusyField.bind(that, mCorrItemsProperties.CorrespondenceType, false, oContext)
				);
			}, function() {
				var sErrorMessage = that.translateText("INVALIDCOMPANY");
				that._handleWrongCompanyCode(sErrorMessage, oContext);
			}).then(
				this.setCorrItemsBusyField.bind(this, mCorrItemsProperties.CompanyCode, false, oContext)
			);
		},

		serverValidateCompanyCode: function(sCompanyCode) {
			var that = this;

			return new Promise(function(resolve, reject) {
				that.oModel.read("/" + that.oModel.createKey(mEntitySets.CompanySet, {CompanyCode: sCompanyCode}), {
					success: function(oData, oResponse) {
						resolve(oData);
					},
					error: function(oData, oResponse) {
						reject(oData);
					}
				});
			});
		},

		_handleWrongCompanyCode: function(sErrorMessage, oContext) {
			this._setValueState(mCorrItemsProperties.CompanyCode, ValueState.Error, oContext);
			this._setValueStateText(mCorrItemsProperties.CompanyCode, sErrorMessage, oContext);

			this.updatePopoverMessagesModel({
				title: this._getLabelForProperty.call(this, mCorrItemsProperties.CompanyCode),
				subtitle: sErrorMessage,
				key: mCorrItemsProperties.CompanyCode
			}, oContext);

			// disable correspondences
			this.setCorrItemsEditableField(mCorrItemsProperties.CorrespondenceType, false, oContext);
			this._resetCorrItemsModelVisibility(oContext);
			this._validateCorrespondenceItemInput(oContext);
			this.setCorrItemsBasicField(mCorrItemsProperties.CompanyCodeName, undefined, oContext);
		},

		serverValidateAccountNumber: function(sAccountNumber, sCompanyCode, sType) {
			var that = this;

			var sEntitySet = (sType === mCorrItemsProperties.CustomerNumber) ? mEntitySets.CustomerNumberSet : mEntitySets.VendorNumberSet;
			var sParam = (sType === mCorrItemsProperties.CustomerNumber) ? mUrlParameters.Customer : mUrlParameters.Supplier;
			var oParams = {
				CompanyCode: sCompanyCode
			};
			oParams[sParam] = sAccountNumber;

			return new Promise(function(resolve, reject) {
				that.oModel.read("/" + that.oModel.createKey(sEntitySet, oParams), {
					success: resolve,
					error: reject
				});
			});
		},

		_handleWrongAccountNumber: function(oContext, sType) {
			var sErrorType = (sType === mInputFields.CustomerNumber) ? "INVALIDCUSTOMER" : "INVALIDSUPPLIER";
			var sErrorMessage = this.translateText(sErrorType);

			this._setValueState(sType, ValueState.Error, oContext);
			this._setValueStateText(sType, sErrorMessage, oContext);

			this.updatePopoverMessagesModel({
				title: this._getLabelForProperty.call(this, sType),
				subtitle: sErrorMessage,
				key: sType
			}, oContext);
		},


		/**
		 * Returns true if current ListMode on the Master Page list is MultiSelect
		 *
		 * @return {boolean} true if ListMode active
		 * @private
		 */
		_isMultiSelectMode: function() {
			return this._getModelProperty(this.oStateModel, mStateProperties.ListMode) === ListMode.MultiSelect;
		},

		/**
		 * Get label for property in specified entity type.
		 * @param {string} sPropertyName Property name.
		 * @param {string} [sEntityType=CorrOutput] Name of the entity set.
		 * @returns {string} Property label.
		 * @private
		 */
		_getLabelForProperty: function(sPropertyName, sEntityType) {
			sEntityType = sEntityType || mEntityTypes.CorrOutput; // eslint-disable-line no-param-reassign
			var oMetaModel = this.oModel.getMetaModel();
			var oEntity = oMetaModel.getODataEntityType(mServices.Correspondence + "." + sEntityType);
			var sPropertyLabel = oMetaModel.getODataProperty(oEntity, sPropertyName)["sap:label"];

			return sPropertyLabel;
		},

		_resetCorrespondenceSelection: function() {
			this.setCorrItemsModelProperty(mModelPropertyTypes.SelectedCorrespondence, null);
			this._setDataProperty(mInputFields.Event, "");
		},

		/**
		 * Validates input for given correspondence context
		 *
		 * @param {object} oContext context in corrItems model
		 * @param {boolean} [bSkipEmpty=false] whether input fields that are empty should be considered as invalid or not
		 * @return {boolean} true if data valid
		 * @private
		 */
		_validateCorrespondenceItemInput: function(oContext, bSkipEmpty) {
			var bValid;

			if (oContext === this.getActiveBindingContext()) {
				this.copyOdataToLocal(oContext);
			}

			bValid = this._validateGenericField(mInputFields.CompanyCode, oContext, bSkipEmpty);
			bValid = this._validateGenericField(mInputFields.Event, oContext, bSkipEmpty, this.translateText("CORR_TYPE_COMBOBOX_ERROR")) && bValid;
			bValid = this._validateGenericField(mInputFields.CustomerNumber, oContext, bSkipEmpty) && bValid;
			bValid = this._validateGenericField(mInputFields.VendorNumber, oContext, bSkipEmpty) && bValid;
			bValid = this._validateDocumentNumber(oContext, bSkipEmpty) && bValid;
			bValid = this._validateFiscalYear(oContext, bSkipEmpty) && bValid;
			bValid = this._validateDates(oContext, bSkipEmpty) && bValid;
			bValid = this._validateAdvancedParameters(oContext) && bValid;


			return bValid;
		},

		/**
		 * Validates all VISIBLE controls. They must not be emtpy and correspondence type selector cannot hold 'blank' item.
		 *
		 * @param {object} [aCorrItems] validate specified correspondence items. Defaults to active one.
		 * @returns {boolean} true if all VISIBLE controls are valid
		 * @param {boolean} [bSkipEmpty=false] whether input fields that are empty should be considered as invalid or not
		 * @private
		 */
		_validateInput: function(aCorrItems, bSkipEmpty) {
			aCorrItems = aCorrItems || [this.oActiveCorrListItem];	// eslint-disable-line no-param-reassign
			var bValid = true;

			aCorrItems.forEach(function(oItem) {
				if (oItem.getVisible()) {
					var oContext = oItem.getBindingContext(mModelNames.CorrItems);
					bValid = this._validateCorrespondenceItemInput(oContext, bSkipEmpty) && bValid;
				}
			}, this);
			return bValid;
		},

		_validateAdvancedParameters: function(oContext) {
			var oSelectedCorrespondence = this.getCorrItemsModelProperty(mModelPropertyTypes.SelectedCorrespondence, oContext);

			if (!oSelectedCorrespondence) {
				return true;
			}

			var aGroups = oSelectedCorrespondence.AdvancedParameters;
			var aMessages;

			if (!aGroups) {
				return true;
			}

			aMessages = AdvancedParameters.validate(aGroups, this.translateText("INPUT_REQUIRED_ERROR"), this.translateCoreText("VALUE_STATE_ERROR"));

			// propagate changes from the model
			this.oCorrItemsModel.refresh();

			if (aMessages.length) {
				this.updatePopoverMessagesModel(aMessages, oContext);
			}

			return aMessages.length === 0;
		},

		/**
		 * Validates field. Returns true if the field is hidden or valid. Otherwise false.
		 * @param {string} sKey mBindings key
		 * @param {object} oContext context in corrItems model
		 * @param {boolean} [bSkipEmpty=true] If set to true, treats empty value as valid state.
		 * @returns {boolean} Returns true if the field is hidden or valid. Otherwise false.
		 * @private
		 */
		_validateGenericField: function(sKey, oContext, bSkipEmpty, sCustomErrorMessage) {
			var sValue;
			var bValid = true;
			var sValueStateText;

			var sMappedKey = (sKey === mInputFields.Event) ? mCorrItemsProperties.CorrespondenceType : sKey;
			sValue = this._getCorrItemPropertyValue(sKey, sMappedKey, oContext);

			var bBusy = this.getCorrItemsBusyField(sMappedKey, oContext);

			var bFieldVisible = this.getCorrItemsVisibleField(sMappedKey, oContext);
			var bFieldEditable = this.getCorrItemsEditableField(sMappedKey, oContext);

			if (bFieldVisible && bFieldEditable) {
				bValid = (this.getCorrItemsValueStateField(sMappedKey, oContext) !== ValueState.Error);

				if (!sValue && !bSkipEmpty) {
					bValid = false;
					this.setCorrItemsValueStateTextField(sMappedKey, sCustomErrorMessage ? sCustomErrorMessage : this.translateText("INPUT_REQUIRED_ERROR"), oContext);
				}
			}

			if (!bValid) {
				this._setValueState(sMappedKey, ValueState.Error, oContext);

				sValueStateText = this.getCorrItemsValueStateTextField(sMappedKey, oContext);

				this.updatePopoverMessagesModel({
					title: this._getLabelForProperty.call(this, sKey),
					subtitle: sValueStateText || this.translateCoreText("VALUE_STATE_ERROR"),
					key: sMappedKey
				}, oContext);
				bValid = false;
			} else {
				this._setValueState(sMappedKey, ValueState.None, oContext);
				this.removePopoverMessages(sMappedKey, oContext);
			}

			// e.g. CorrespondenceType is not filled yet and is uneditable - it should not get error state
			// but corrspondence cannot be generated, so we return bValid=false
			// if field is busy, that means that validation is happening, thus field is not valid yet
			if ((bFieldVisible && !bFieldEditable && !sValue && !bSkipEmpty) || bBusy) {
				bValid = false;
			}

			return bValid;
		},

		_getMessageKey: function(oContext, sKey) {
			return oContext.getProperty(mModelPropertyTypes.Id) + "-" + sKey;
		},

		/**
		 * Show or hide pdf preview.
		 *
		 * @param {boolean} bShow Tru for visible pdf, false for hidden.
		 * @private
		 */
		_setPdfVisibility: function(bShow) {
			this.oPdf.$().css("display", bShow ? "block" : "none");
		},

		/**
		 * Hide IFrame with pdf preview.
		 *
		 * @private
		 */
		_hidePdfVisibility: function() {
			this._setPdfVisibility(false);
		},

		/**
		 * Returns true if Mock Server is running and false if not.
		 * 
		 * @private
		 * @returns {Boolea} Returns true if MockServer is running
		 */
		_isMockServerRunning: function() {
			var currentScript = document.getElementById('locate-reuse-libs');
			if(!currentScript){
				currentScript = document.currentScript;
			}
			var useMockserver = currentScript && currentScript.getAttribute("data-sap-ui-use-mockserver");
			return useMockserver && useMockserver === "true";
		},

		/**
		 * Get Fake Preview Url
		 * 
		 * @returns {String} Url of Fake Preview
		 */
		_getFakePreviewUrl: function() {
			return jQuery.sap.getModulePath("fin.ar.correspondence.create.v2", "/localService/correspondence.pdf");
		},

		/**
		 * Sets URL for pdf. In case mock server is used, URL is predefined for local file (we don't want to contact backend service from tests).
		 *
		 * @param {string} sPreviewUrl Url to set.
		 * @private
		 */
		_setPdfUrl: function(sPreviewUrl) {
			var sUrl = this._isMockServerRunning()
				? this._getFakePreviewUrl()
				: sPreviewUrl;

			this.setCorrItemsModelProperty(mCorrItemsProperties.PdfPath, sUrl);
			// this.oPdf.setSource(sUrl);
			this.oPdf.invalidate();
		},

		/**
		 * Init callbacks for pdf viewer.
		 *
		 * @private
		 */
		_initPdf: function() {
			var that = this;
			var fnHandlePdfEvent = function(oEvent) {
				that._setPdfVisibility(true);

				if (oEvent.getId() === "error") {
					var oPDFIframe = that.oPdf.$().find("iframe");

					if(oPDFIframe.length > 0){
						var oError = that.getErrorHandler().handlePdfError(oPDFIframe[0].contentWindow.document);
						var bHasError = oError.errorMessage;

						// for Error remove iFrame URL (carefull it triggers load again)
						if (bHasError) {
							// mark corresponding controls as invalid
							that.processCustomErrorStates({
								isCustomer: oError.isCustomer,
								isVendor: oError.isVendor
							});
							that._hidePdfAndEmailTabsContent();
						}
					}

				}
			};

			this.oPdf.attachSourceValidationFailed(fnHandlePdfEvent);
			this.oPdf.attachLoaded(fnHandlePdfEvent);
			this.oPdf.attachError(fnHandlePdfEvent);
		},

		/**
		 * Process errors and set corresponding controls to invalid state
		 *
		 * @param {object} mParams input parameters
		 * @param {boolean} mParams.isCustomer true for marking customer control as invalid
		 * @param {boolean} mParams.isVendor true for marking vendor control as invalid
		 * @public
		 */
		processCustomErrorStates: function(mParams) {
			if (mParams.isCustomer || mParams.isVendor) {
				var sKey = (mParams.isCustomer) ? mInputFields.CustomerNumber : mInputFields.VendorNumber;
				var oControl = this.byId(mIds[sKey]);

				this._setValueState(sKey, ValueState.Error);

				this.updatePopoverMessagesModel({
					title: this._getLabelForProperty.call(this, sKey),
					subtitle: oControl.getValueStateText() || this.translateCoreText("VALUE_STATE_ERROR"),
					key: sKey
				});
			}
		},

		/**
		 * Transfer visible controls data from model to output object.
		 *
		 * @param {object} [oContext] if not given, active context is used
		 *
		 * @public
		 * @returns {object} all visible controls' values
		 */
		getInputData: function(oContext) {
			oContext = oContext ? oContext : this.oActiveCorrListItem.getBindingContext(mModelNames.CorrItems); // eslint-disable-line no-param-reassign

			if (oContext === this.getActiveBindingContext()) {
				this.copyOdataToLocal(oContext);
			}

			var oArgs = {};

			oArgs[mInputFields.CompanyCode] = this._getVisibleBindings(mCorrItemsProperties.CompanyCode, oContext);
			oArgs[mInputFields.CorrespondenceType] = this.getCorrItemsSelectedCorrespondenceField(mCorrItemsProperties.Id, oContext);
			oArgs[mInputFields.Event] = this.getCorrItemsSelectedCorrespondenceField(mCorrItemsProperties.Event, oContext);
			oArgs[mInputFields.Variant] = this.getCorrItemsSelectedCorrespondenceField(mCorrItemsProperties.Variant, oContext);
			oArgs[mInputFields.DocumentNumber] = this._getVisibleBindings(mCorrItemsProperties.DocumentNumber, oContext);
			oArgs[mInputFields.FiscalYear] = this._getVisibleBindings(mCorrItemsProperties.FiscalYear, oContext);
			oArgs[mInputFields.Date1] = this._getVisibleBindings(mCorrItemsProperties.Date1, oContext);
			oArgs[mInputFields.Date2] = this._getVisibleBindings(mCorrItemsProperties.Date2, oContext);

			var sAccountType = this._getVisibleBindings(mCorrItemsProperties.AccountType, oContext);
			if (sAccountType === mAccountType.Customer) {
				oArgs[mInputFields.CustomerNumber] = this._getVisibleBindings(mCorrItemsProperties.CustomerNumber, oContext);
			} else if (sAccountType === mAccountType.Vendor) {
				oArgs[mInputFields.VendorNumber] = this._getVisibleBindings(mCorrItemsProperties.VendorNumber, oContext);
			}

			oArgs.OutputParams = JSON.stringify(this._getAdvancedParameters(oContext));

			return oArgs;
		},

		_getVisibleBindings: function(sPropName, oContext) {
			var bVisible = this.getCorrItemsVisibleField(sPropName, oContext);

			if (bVisible) {
				return this.getCorrItemsBasicField(sPropName, oContext);
			} else {
				return undefined;
			}
		},

		_getAdvancedParameters: function(oContext) {
			var oSelectedCorrespondence = this.getCorrItemsModelProperty(mModelPropertyTypes.SelectedCorrespondence, oContext);
			var aOutputParams = [];

			if (oSelectedCorrespondence && oSelectedCorrespondence.AdvancedParameters) {
				oSelectedCorrespondence.AdvancedParameters.forEach(function(oGroup) {
					oGroup[mCorrItemsProperties.ParameterSet].forEach(function(oParam) {
						var oSendParam = {
							NAME: oParam.Id,
							VALUE: AdvancedParameters._getOutputAdvancedParameterValue(oParam)
						};
						aOutputParams.push(oSendParam);
					});
				});
			}

			return aOutputParams;
		},

		/**
		 * Reset some fields after company is changed
		 *
		 * @param {object} oContext Binding context of corrItemsModel
		 * @private
		 */
		_resetObject: function(oContext) {
			// we reset only company code dependent fields and only if they are not read only
			// which should not be possible, because when custemer is read only, company code should be as well
			// but just to be sure
			var customerEnabled = this.getCorrItemsEditableField(mCorrItemsProperties.CustomerNumber, oContext);
			var vendorEnabled = this.getCorrItemsEditableField(mCorrItemsProperties.VendorNumber, oContext);

			if (customerEnabled) {
				this._setDataProperty(mInputFields.CustomerNumber, "");
				this._setValueState(mInputFields.CustomerNumber, ValueState.None);
			}

			if (vendorEnabled) {
				this._setDataProperty(mInputFields.VendorNumber, "");
				this._setValueState(mInputFields.VendorNumber, ValueState.None);
			}
		},

		/**
		 * Init dialog for further use
		 * @param {object} oController Dialog's controller
		 * @param {string} sFragmentName Dialog's fragment name
		 * @returns {object} oDialog Dialog's fragment object
		 *
		 * @private
		 */
		_initDialog: function(oController, sFragmentName) {
			var oDialog = sap.ui.xmlfragment(oController.Id, sFragmentName, oController);

			oController.initDialog({
				dialog: oDialog,
				model: this.oModel,
				controller: this
			});

			this.oView.byId("idDetailPage").addDependent(oDialog);

			return oDialog;
		},


		/**
		 * Init email preview tab form
		 *
		 * @param {object} oContext binding context for corrItemsModel
		 * @returns {Promise} promise
		 * @private
		 */
		_loadEmailPreviewTab: function(oContext) {
			var that = this;
			var oOptions = {};

			return this.loadDefaultsForDialog(oContext).then(function(aData) {
				oOptions.defaultData = ModelUtils.getDefaultDialogData(mDialogTypes.Email, aData, oContext);

				that.oEmailFormController.setData(oOptions, oContext);

				return aData;
			});
		},

		/**
		 * This function loads default settings for dialog (recipient, printer) and fill it
		 *
		 * @param {object} oContext corrItems model context
		 * @returns {Promise} Promise with default data for dialog
		 */
		loadDefaultsForDialog: function(oContext) {
			var that = this;
			var bInvalidateDialog = this.getCorrItemsDialogField(mCorrItemsProperties.InvalidateDialog, oContext);

			if (!bInvalidateDialog) {
				var oDialogData = this.getCorrItemsDialogField(mCorrItemsProperties.DialogDefaultData, oContext);
				return Promise.resolve(oDialogData);
			}

			var oInputData = this.getInputData(oContext);
			oInputData.Date1 = (oInputData.Date1) ? oInputData.Date1.toISOString() : undefined;
			oInputData.Date2 = (oInputData.Date2) ? oInputData.Date2.toISOString() : undefined;

			var oSenderObject = jQuery.extend({}, ModelUtils.getDefaultValuesSenderObject(), oInputData);

			delete oSenderObject.OutputParams;

			this.setBusy();

			return new Promise(function(fnResolve, fnReject) {
				that.oModel.callFunction(mFunctionImports.GetDefaultValues, {
					urlParameters: oSenderObject,
					success: function(oData, oResponse) {
						var oDefaultData = oData.results;
						that.setCorrItemsDialogField(mCorrItemsProperties.DialogDefaultData, oDefaultData, oContext);
						that.setCorrItemsDialogField(mCorrItemsProperties.InvalidateDialog, false, oContext);
						that.setNotBusy();
						fnResolve(oDefaultData);
					},
					error: function(oError) {
						that.setNotBusy();
						fnReject(oError);
					}
				});
			});
		},

		_onEmptyMasterMatched: function(oEvent) {
			var oMasterPage = this.oView.byId(mIds.MasterPage);
			var oSplitPage = this.oView.byId(mIds.Page);

			oSplitPage.toMaster(oMasterPage.getId());
		},

		_onPreviewMatched: function(oEvent) {
			var oDetailPage = this.oView.byId(mIds.DetailPage);
			var oSplitPage = this.oView.byId(mIds.Page);

			oSplitPage.toDetail(oDetailPage.getId());
		},

		_setActiveClass: function(oItem, bActive) {
			var sClass = "sapMLIBSelected";

			if (bActive) {
				oItem.$().addClass(sClass);
			} else {
				oItem.$().removeClass(sClass);
			}
		},

		_setMassActiveClass: function() {
			var aItems = this.oList.getItems();
			aItems.forEach(function(oItem) {
				var oContext = oItem.getBindingContext(mModelNames.CorrItems);
				var bIsActive = this.getCorrItemsModelProperty(mCorrItemsProperties.IsActive, oContext);
				this._setActiveClass(oItem, bIsActive);
			}, this);
		},

		// ===========================================================
		// model private methods
		// ===========================================================

		/**
		 * Reset display to default state
		 *
		 * @param {object} oContext corrItems model context
		 * @private
		 */
		_resetCorrItemsModelVisibility: function(oContext) {
			if (this.getCorrItemsCount() === 0) {
				return;
			}

			var oDefaultData = ModelUtils.getDefaultCorrItemVisibleObject();

			this.setCorrItemsModelProperty(mModelPropertyTypes.Visible, oDefaultData, oContext);
		},

		/**
		 * Set correct printer type to true in corrItems visible model. Set other printer types to false.
		 *
		 * @param {string} sPrinterType Name of the printer type property that should be set to visible
		 * @param {object} oContext corrItems model context
		 * @private
		 */
		_setDisplayPrintProperty: function(sPrinterType, oContext) {
			Object.keys(mPrinters).forEach(function(sKey) {
				this.setCorrItemsVisibleField(sKey, (sKey === sPrinterType), oContext);
			}, this);
		},

		/**
		 * Set validation state (Error, None) to correspondence item model state value
		 *
		 * @param {string} sProperty name of property
		 * @param {string} sState to insert
		 * @param {object} [oContext] if not given, default context of the view is used
		 * @private
		 */
		_setValueState: function(sProperty, sState, oContext) {
			sProperty = (sProperty === mInputFields.Event) ? mCorrItemsProperties.CorrespondenceType : sProperty;	// eslint-disable-line no-param-reassign
			this.setCorrItemsValueStateField(sProperty, sState, oContext);
		},

		/**
		 * Set validation text to state model. This state is applied if state is 'Error'
		 * @param {string} sProperty name of property
		 * @param {string} sText Text to insert
		 * @param {object} [oContext] if not given, default context of the view is used
		 * @private
		 */
		_setValueStateText: function(sProperty, sText, oContext) {
			sProperty = (sProperty === mInputFields.Event) ? mCorrItemsProperties.CorrespondenceType : sProperty;	// eslint-disable-line no-param-reassign
			this.setCorrItemsValueStateTextField(sProperty, sText, oContext);
		},

		/**
		 * Sets value to display mode
		 *
		 * @param {string} sKey Key for model
		 * @param {object} oValue Value to set
		 * @private
		 */
		_setDisplayProperty: function(sKey, oValue) {
			this._setModelProperty(this.oDisplayModel, sKey, oValue);
		},

		/**
		 * Returns value from given model
		 *
		 * @param {object|string} vModel Model to look in
		 * @param {string} sKey for storage. If it not starts with '/', it's automatically added
		 *
		 * @returns {object} returned value from model
		 */
		_getModelProperty: function(vModel, sKey) {
			sKey = (sKey[0] !== "/") ? "/" + sKey : sKey; // eslint-disable-line no-param-reassign
			var sProperty;

			if (typeof vModel === "string") {
				sProperty = this.getModel(vModel).getProperty(sKey);
			} else {
				sProperty = vModel.getProperty(sKey);
			}

			return sProperty;
		},

		/**
		 * Sets value to model.
		 *
		 * @param {object} oModel Model value is set to
		 * @param {string} sKey Key for model storage. If it not starts with '/', it's automatically added
		 * @param {object|string} vValue value to set
		 */
		_setModelProperty: function(oModel, sKey, vValue) {
			var startsWithSlash = (sKey[0] === "/"),
				sResultKey = sKey;
			if (!startsWithSlash) {
				sResultKey = "/" + sKey;
			}
			oModel.setProperty(sResultKey, vValue);
		},

		_setModelProperties: function(oModel, aKeys, vValue) {
			aKeys.forEach(function(sKey) {
				this._setModelProperty(oModel, sKey, vValue);
			}, this);
		},

		/**
		 * Set value to model based on view default binding.
		 *
		 * @param {string} sKey Key for storage
		 * @param {object} oValue Value to save
		 *
		 * @private
		 */
		_setDataProperty: function(sKey, oValue) {
			var sPath = this._getBindingPath();
			this.oModel.setProperty(sPath + sKey, oValue);
		},

		_getBindingPath: function() {
			var oContext = this.getView().getBindingContext();

			return oContext.getPath() + "/";
		},

		/**
		 * Retrieves value from model based on view default binding path.
		 *
		 * @param {string} sKey Key for storage
		 * @private
		 * @returns {object} return value
		 */
		_getDataProperty: function(sKey) {
			var sPath = this._getBindingPath();

			return this.oModel.getProperty(sPath + sKey);
		},

		processDisplayCorrespondenceHistoryAvailable: function() {
			var navigationService = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService("CrossApplicationNavigation");

			if (navigationService) {
				navigationService.getLinks({
					semanticObject: mExternalActions.DCHSemanticObject,
					action: mExternalActions.DCHAction
				})
					.then(this._navigationHistorySuccess.bind(this))
					.fail(this._navigationHistoryError.bind(this));
			} else {
				this._setDisplayProperty(mDisplaySettings.HistoryNavigation, false);
			}
		},

		_navigationHistorySuccess: function(aIntentCount){
			if (aIntentCount.length === 0) {
				this._setDisplayProperty(mDisplaySettings.HistoryNavigation, false);
			}
		},

		_navigationHistoryError: function (sError) {
			this._setDisplayProperty(mDisplaySettings.HistoryNavigation, false);
			jQuery.sap.log.error(sError);
		},

		/**
		 * Returns value of the property from model
		 *
		 * @param {string} sInputFieldName Ids mapping
		 * @param {string} sPropertyName CorrItemsProperties mapping
		 * @param {object} oContext of the item
		 * @return {string} value
		 * @private
		 */
		_getCorrItemPropertyValue: function(sInputFieldName, sPropertyName, oContext) {
			return this.getCorrItemsBasicField(sPropertyName, oContext);
		},

		getCorrItemsBasicField: function(sProperty, oContext) {
			var sPath = ModelUtils.getBasicFieldPropertyPath(sProperty);
			return this.getCorrItemsModelProperty(sPath, oContext);
		},

		setCorrItemsBasicField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getBasicFieldPropertyPath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		getCorrItemsDialogField: function(sProperty, oContext) {
			var sPath = ModelUtils.getDialogPropertyPath(sProperty);
			return this.getCorrItemsModelProperty(sPath, oContext);
		},

		setCorrItemsDialogField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getDialogPropertyPath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		getCorrItemsEmailField: function(sProperty, oContext) {
			var sPath = ModelUtils.getEmailPropertyPath(sProperty);
			return this.getCorrItemsModelProperty(sPath, oContext);
		},

		setCorrItemsEmailField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getEmailPropertyPath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		getCorrItemsEditableField: function(sProperty, oContext) {
			var sPath = ModelUtils.getEditablePropertyPath(sProperty);
			return this.getCorrItemsModelProperty(sPath, oContext);
		},

		setCorrItemsEditableField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getEditablePropertyPath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		setCorrItemsEnabledField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getEnabledPropertyPath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		getCorrItemsVisibleField: function(sProperty, oContext) {
			var sPath = ModelUtils.getVisiblePropertyPath(sProperty);
			return this.getCorrItemsModelProperty(sPath, oContext);
		},

		setCorrItemsVisibleField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getVisiblePropertyPath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		getCorrItemsSelectedCorrespondenceField: function(sProperty, oContext) {
			var sPath = ModelUtils.getSelectedCorrespondencePath(sProperty);
			return this.getCorrItemsModelProperty(sPath, oContext);
		},

		setCorrItemsSelectedCorrespondenceField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getSelectedCorrespondencePath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		getCorrItemsStateField: function(sProperty, oContext) {
			var sPath = ModelUtils.getStatePropertyPath(sProperty);
			return this.getCorrItemsModelProperty(sPath, oContext);
		},

		setCorrItemsStateField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getStatePropertyPath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		getCorrItemsValueStateField: function(sProperty, oContext) {
			var sPath = ModelUtils.getValueStatePropertyPath(sProperty);
			return this.getCorrItemsModelProperty(sPath, oContext);
		},

		setCorrItemsValueStateField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getValueStatePropertyPath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		getCorrItemsValueStateTextField: function(sProperty, oContext) {
			var sPath = ModelUtils.getValueStateTextPropertyPath(sProperty);
			return this.getCorrItemsModelProperty(sPath, oContext);
		},

		setCorrItemsValueStateTextField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getValueStateTextPropertyPath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		getCorrItemsBusyField: function(sProperty, oContext) {
			var sPath = ModelUtils.getBusyFieldPropertyPath(sProperty);
			return this.getCorrItemsModelProperty(sPath, oContext);
		},

		setCorrItemsBusyField: function(sProperty, vValue, oContext) {
			var sPath = ModelUtils.getBusyFieldPropertyPath(sProperty);
			return this.setCorrItemsModelProperty(sPath, vValue, oContext);
		},

		/**
		 * Get value from CorrItems model property
		 *
		 * @param {string} sProperty property name
		 * @param {object} [oContext] if not given, default context of the view is used
		 *
		 * @returns {object} property value
		 * @private
		 */
		getCorrItemsModelProperty: function(sProperty, oContext) {
			var sPath = this.getCorrItemsModelContextBindingPath(oContext);

			return this.oCorrItemsModel.getProperty(sPath + "/" + sProperty);
		},

		/**
		 * Set value to CorrItems model property
		 *
		 * @param {string} sProperty Key for storage
		 * @param {object} vValue property name
		 * @param {object} [oContext] if not given, default context of the view is used
		 * @private
		 */
		setCorrItemsModelProperty: function(sProperty, vValue, oContext) {
			var sPath = this.getCorrItemsModelContextBindingPath(oContext);

			this.oCorrItemsModel.setProperty(sPath + "/" + sProperty, vValue);
		},

		/**
		 * Returns path for given or current binding context of corr items model
		 *
		 * @param {object} [oContext] if not given, default context of the view is used
		 *
		 * @returns {string} context binding path
		 * @private
		 */
		getCorrItemsModelContextBindingPath: function(oContext) {
			oContext = oContext ? oContext : this.getActiveBindingContext(); // eslint-disable-line no-param-reassign

			return oContext ? oContext.getPath() : "";
		},

		getActiveBindingContext: function() {
			var oContext;

			if (this.oActiveCorrListItem) {
				oContext = this.oActiveCorrListItem.getBindingContext(mModelNames.CorrItems);
			}

			return oContext;
		},

		/**
		 * When user fills in all required parameters and then click on either "Pdf Preview"
		 * or "Email Preview" tab, then it needs to be ensured that the pdf viewer
		 * is made visible after the email form. It needs to be ensured because changing visibility
		 * of the email form invalidates the Pdf Viewer. Pdf Viewer downloads the Pdf File twice
		 * when it gets invalidated.
		 *
		 * @private
		 */
		_showPdfAndEmailTabsContent: function(oContext) {
			var sIsPdfViewerVisiblePath = ModelUtils.getStatePropertyPath(mCorrItemsProperties.IsPdfViewerVisible);
			var sIsEmailFormVisiblePath = ModelUtils.getStatePropertyPath(mCorrItemsProperties.IsEmailFormVisible);
			this.setCorrItemsModelProperty(sIsEmailFormVisiblePath, true, oContext);
			setTimeout(function() {
				this.setCorrItemsModelProperty(sIsPdfViewerVisiblePath, true, oContext);
			}.bind(this), 0);
		},

		/*
		 * When parameters in the first tabs are changed, then content of the Pdf and Email Tabs
		 * is hidden. It will be set back to visible after new data from backend
		 * are retrieved and saved to model.

		 @private
		 */
		_hidePdfAndEmailTabsContent: function(oContext) {
			var sIsPdfViewerVisiblePath = ModelUtils.getStatePropertyPath(mCorrItemsProperties.IsPdfViewerVisible, oContext);
			var sIsEmailFormVisiblePath = ModelUtils.getStatePropertyPath(mCorrItemsProperties.IsEmailFormVisible, oContext);
			this.setCorrItemsModelProperty(sIsPdfViewerVisiblePath, false, oContext);
			this.setCorrItemsModelProperty(sIsEmailFormVisiblePath, false, oContext);
		},

		_createPathToPdfFromApplicationObjectId: function(sApplicationObjectId) {
			return this.getModel().sServiceUrl + "/" +
				this.oModel.createKey(mEntitySets.CorrOutputSet, {ApplicationObjectId: sApplicationObjectId}) +
				"/PDF/$value/";
		},

		_getApplicationObjectIdFromServer: function(oParameters) {
			return new Promise(function(fnResolve) {
				this.oModel.create("/" + mEntitySets.CorrOutputSet,
				oParameters,
				{
					success: function(oData) {
						fnResolve(oData.ApplicationObjectId);
					}.bind(this)
				});
			}.bind(this));
		}
	});
});
