declare module "homey-api/lib/HomeyAPI/HomeyAPI.js" {
  const HomeyAPI: {
    createLocalAPI(options: {
      address: string;
      token: string;
      debug: null;
    }): Promise<import("./homeyTypes").HomeyConnection>;
  };
  export default HomeyAPI;
}
