// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import disposable from "disposable-email-domains";
const dnscache = require("dnscache");
import dns from "dns";
import fs from "fs";
import list from "../../../data/list.json";
import newlist from "../../../data/newlist.json";
import extractDomain from "extract-domain";

async function dns_checker(domain: any): Promise<boolean> {
  return new Promise((resolve, reject) => {
    dns.resolveMx(
      domain,
      (err: NodeJS.ErrnoException | null, addresses: dns.MxRecord[]) => {
        if (err) {
          return resolve(false);
        }
        return resolve(addresses.length > 0);
      }
    );
  });
}
type Error = {
  message: string;
};
type Data = {
  valid?: boolean;
  disposable?: boolean;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "405 Method Not Allowed" });
  }

  const email = req.query.domain as string;
  if (!email) return res.status(400).json({ message: "Please provide email" });
  const domain = extractDomain(email);
  const disposable = [...list, ...newlist].includes(domain);
  const valid = await dns_checker(domain);
  if (!valid) {
    return res.status(200).json({
      block: true,
      valid,
      domain,
      disposable,
      text: "Invalid domain",
      reason: "Unable to get domain",
      mx_host: domain,
      mx_ip: null,
    });
  }

  const mx_host: string[] = await getMxHost(domain);
  const mx_ip: string[] = await getIpv4(mx_host);
  const mx_priority = await getMxPriority(domain);

  return res.status(200).json({
    block: disposable,
    valid,
    domain,
    disposable,
    text: disposable
      ? "Disposable or temporary domain"
      : `${domain} looks fine`,
    reason: disposable
      ? `${domain} is blacklisted domain`
      : "Whitelisted domain",
    mx_host,
    mx_ip,
    mx_priority,
  });
}

async function getIpv4(addresses: string[]): Promise<string[]> {
  return new Promise((res, rej) => {
    let ips: string[] = [];
    let count = 0;
    addresses.forEach((add) => {
      count++;
      dns.resolve(add, (err: NodeJS.ErrnoException | null, adds: string[]) => {
        if (err) {
          return rej(err);
        }
        adds.forEach((a) => ips.push(a));
        if (count === addresses.length) {
          res(ips);
        }
      });
    });
  });
}
async function getMxHost(domain: string): Promise<string[]> {
  return new Promise((res, rej) => {
    let mx_host: string[] = [];
    dns.resolveMx(
      domain,
      async (err: NodeJS.ErrnoException | null, addresses: dns.MxRecord[]) => {
        if (err) {
          return rej(err);
        }
        addresses.forEach((a) => mx_host.push(a.exchange));
        res(mx_host);
      }
    );
  });
}
async function getMxPriority(domain: string): Promise<any> {
  return new Promise((res, rej) => {
    let mx_host: any = {};
    dns.resolveMx(
      domain,
      async (err: NodeJS.ErrnoException | null, addresses: dns.MxRecord[]) => {
        if (err) {
          return rej(err);
        }
        addresses.forEach((a) => (mx_host[a.exchange] = a.priority));
        res(mx_host);
      }
    );
  });
}
