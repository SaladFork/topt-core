
/**
 * Collection of settings used in core
 */
export class CoreSettings {

    /**
     * Service ID used to connect to the event stream
     */
    public serviceID: string = "";

    /**
     * If the dark mode CSS will be added
     */
    public darkMode: boolean = true;

    /**
     * ID of the server to listen to login/logout and facility events
     */
    public serverID: string = "17";

    /**
     * If debug options will be shown
     */
    public debug: boolean = false;

}
